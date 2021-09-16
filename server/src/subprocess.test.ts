import * as assert from "assert";
import {
    dataNodeError,
    getExecutable,
    parseErrors,
    parsePluginWithSubprocess,
    shipEntityError,
    shipMissingEquippedOutfit,
    TEMP_PLUGIN_NAME,
    withPreparedFilesystem,
} from "./subprocess";
import { readdirSync, existsSync, mkdirSync, rmdirSync, mkdtempSync } from "fs";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Endless Sky and the filesystem", () => {
    let pluginDir = "";
    const filename = "ships.txt";
    const contents = `Ship Canoe\n\tdescription "small"`;

    before(() => {
        pluginDir = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-"));
        fs.mkdirSync(path.join(pluginDir, "data"));
        fs.writeFileSync(path.join(pluginDir, "data", filename), contents);
    });

    after(() => {
        rmdirSync(pluginDir, { recursive: true });
    });

    it("can find an Endless Sky executable", () => {
        assert.strictEqual(!!getExecutable(), true);
    });

    describe("withPreparedFilesystem", () => {
        it("should have config dir when the function runs", async () => {
            const ret: number = await withPreparedFilesystem<number>(
                {},
                async ({ config }) => {
                    assert.strictEqual(typeof config, "string");
                    return 42;
                }
            );
            assert.strictEqual(ret, 42);
        });

        it("should have the plugin folder symlinked in", async () => {
            await withPreparedFilesystem({ pluginDir }, async ({ config }) => {
                const expected = path.join(config, "plugins", TEMP_PLUGIN_NAME);
                assert.strictEqual(existsSync(expected), true);
                const expectedDatafile = path.join(expected, "data", filename);
                assert.strictEqual(
                    fs.readFileSync(expectedDatafile, { encoding: "utf8" }),
                    contents
                );
            });
        });
    });

    describe("parseWithSubprocess", function () {
        this.timeout(15000); // mac was exceeding 2000ms
        it("should be able to read stderr warnings", async () => {
            const output = await parsePluginWithSubprocess(pluginDir);
            assert.deepStrictEqual(output.map(o => {
                const { fullMessage, ...rest } = o;
                return rest;
            }), [
                {
                    file: path.join(pluginDir, "data", filename),
                    lineno: 1,
                    message: "Skipping unrecognized root object:",
                    pat: "dataNodeError",
                },
            ]);
        });
    });
});

// always add a newline to the front when parsing
const sampleOutput = `

Skipping unrecognized root object:
file "/Users/tomb/endless-sky/data/coalition/coalition ships.txt"
L213:   asdf

Skipping unrecognized root object:
file "/Users/tomb/endless-sky/data/coalition/coalition jobs.txt"
L10:   asdfasdf

Skipping unrecognized root object:
file "/Users/tomb/endless-sky/data/human/south jobs.txt"
L10:   aaa

Skipping unrecognized root object:
file "/Users/tomb/endless-sky/data/human/south jobs.txt"
L11:   misssion "Pirate Occupation [0]"

Skipping unrecognized attribute:
file "/Users/tomb/endless-sky/data/human/free worlds start.txt"
L11:   mission "Liberate Kornephoros"
L13:     autosavee

Mixed whitespace usage in file
file /Users/tomb/endless-sky/data/human/ships.txt
L2248:   ship Manta
(Aerie):
Defaulting missing "drag" attribute to 100.0
has outfits:
	1 Heavy Anti-Missile Turret
	1 Large Radar Jammer
	1 LP072a Battery Pack
	1 Hyperdrive
	2 KP-6 Photovoltaic Panel
	1 NT-200 Nucleovoltaic
	3 Laser Rifle
	136 Sidewinder Missile
	2 Sidewinder Missile Rack
	2 Sidewinder Missile Launcher
	1 X3700 Ion Thruster
	1 X3200 Ion Steering
	2 Heavy Laser Turret
	1 D41-HY Shield Generator

Argosy: outfit "Meteor Missile Launcher" equipped but not included in outfit list.
Argosy: outfit "Anti-Missile Turret" equipped but not included in outfit list.
Argosy: outfit "Energy Blaster" equipped but not included in outfit list.
Argosy: outfit "Blaster Turret" equipped but not included in outfit list.
(Arrow):
outfit space: -169
has outfits:
	1 Anti-Missile Turret
	1 Luxury Accommodations
	1 Supercapacitor
	1 Hyperdrive
	1 Dwarf Core
	8 Sidewinder Missile
	2 Sidewinder Missile Pod
	1 Small Radar Jammer
	1 D14-RN Shield Generator
	1 A250 Atomic Thruster
	1 A255 Atomic Steering

(Arrow (Hai)):
outfit space: -158
has outfits:
	1 Luxury Accommodations
	1 Pebble Core
	1 "Benga" Atomic Thruster
	1 Bullfrog Anti-Missile
	1 "Biroo" Atomic Steering
	2 Supercapacitor
	1 Hyperdrive
	8 Sidewinder Missile
	2 Sidewinder Missile Pod
	1 D14-RN Shield Generator

(Auxiliary):
outfit space: -681
has outfits:
	2 Heavy Anti-Missile Turret
	1 Large Radar Jammer
	1 Ramscoop
	1 D67-TM Shield Generator
	1 Water Coolant System
	1 D94-YV Shield Generator
	1 LP288a Battery Pack
	1 Fusion Reactor
	1 Scram Drive
	100 Sidewinder Missile
	2 Sidewinder Missile Launcher
	2 Quad Blaster Turret
	1 X4700 Ion Thruster
	1 X1700 Ion Thruster
	1 X5200 Ion Steering

(Auxiliary (Cargo)):
outfit space: -681
has outfits:
	2 Heavy Anti-Missile Turret
	1 Large Radar Jammer
	1 Ramscoop
	1 D67-TM Shield Generator
	1 Water Coolant System
	1 D94-YV Shield Generator
	1 LP288a Battery Pack
	1 Fusion Reactor
	1 Scram Drive
	100 Sidewinder Missile
	2 Sidewinder Missile Launcher
	2 Quad Blaster Turret
	1 X4700 Ion Thruster
	1 X1700 Ion Thruster
	1 X5200 Ion Steering

(Auxiliary (Transport)):
outfit space: -681
has outfits:
	2 Heavy Anti-Missile Turret
	1 Large Radar Jammer
	1 Ramscoop
	1 D67-TM Shield Generator
	1 Water Coolant System
	1 D94-YV Shield Generator
	1 LP288a Battery Pack
	1 Fusion Reactor
	1 Scram Drive
	100 Sidewinder Missile
	2 Sidewinder Missile Launcher
	2 Quad Blaster Turret
	1 X4700 Ion Thruster
	1 X1700 Ion Thruster
	1 X5200 Ion Steering

`

describe("parse", () => {
    it('find data node errors', () => {
        const matches = [...sampleOutput.toString().matchAll(dataNodeError)];
        //console.log(matches.map(m => m[0]))
        assert.strictEqual(matches.length, 6);
        assert.strictEqual(matches[0].groups!.file!, "/Users/tomb/endless-sky/data/coalition/coalition ships.txt");
        assert.deepStrictEqual(matches[0].groups!.lineno!, '213');
        assert.deepStrictEqual(matches[0].groups!.msg!, "Skipping unrecognized root object:")
    });

    it('find ship entity errors', () => {
        const matches = [...sampleOutput.toString().matchAll(shipEntityError)];
        assert.strictEqual(matches.length, 6);
    });

    it('find ship missing outfit errors', () => {
        const matches = [...sampleOutput.toString().matchAll(shipMissingEquippedOutfit)];
        assert.strictEqual(matches.length, 4);
    });

    it('finds all errors', () => {
        const issues = parseErrors(sampleOutput);

        assert.strictEqual(issues.length, 16)
    });
})
