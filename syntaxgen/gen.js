import fs from "fs";
import path, { dirname } from "path";
import process from "process";
import { fileURLToPath } from "url";

function patternFromFile(filename) {
  const keywords = fs
    .readFileSync(filename, "utf8")
    .split("\n")
    .filter((x) => x); // empty string is falsy

  const name = path.basename(filename, ".txt");

  const multiWord = keywords.filter((w) => w.includes(" "));
  const singleWord = keywords.filter((w) => !w.includes(" "));

  const pat = `"\\\\t((\\"(${multiWord.join(
    "|"
  )})\\")|((?<optionalquote>\\"?)(${singleWord.join(
    "|"
  )})\\\\k<optionalquote>))"`;

  return `
		"${name}Keywords": {
			"patterns": [{
				"name": "keyword.control.endlesssky",
				"match": ${pat} 
			}]
		},`;
}

function language() {
  const files = ["ship.txt", "attribute.txt", "outfit.txt", "weapon.txt"];
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const template = fs.readFileSync(
    __dirname + "/template.tmLanguage.json",
    "utf8"
  );
  const repositoryHeader = '\n\t"repository": {';
  const insertionPoint =
    template.indexOf(repositoryHeader) + repositoryHeader.length;
  if (insertionPoint === -1) {
    throw new Error("bad repository header or template");
  }
  const insert = files
    .map((f) => patternFromFile(__dirname + "/" + f))
    .join("");
  const output =
    template.slice(0, insertionPoint) + insert + template.slice(insertionPoint);
  return output;
}

process.stdout.write(language());
