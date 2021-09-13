const fs = require("fs");
const path = require("path");

function patternFromFile(filename) {
  const keywords = fs
    .readFileSync(filename, "utf8")
    .split("\n")
    .filter((x) => x); // empty string is falsy

  const name = path.basename(filename, ".txt");

  multiWord = keywords.filter((w) => w.includes(" "));
  singleWord = keywords.filter((w) => !w.includes(" "));

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
  files = ["ship.txt", "attribute.txt", "outfit.txt", "weapon.txt"];
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
