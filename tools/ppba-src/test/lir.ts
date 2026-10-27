// Lecture d'une sortie .LIR du programme de référence
import { readFileSync } from "fs";
export function readLIR(path: string) {
  const t = readFileSync(path, "utf8").replace(/\r/g, "");
  const num = (re: RegExp) => { const m = t.match(re); return m ? parseFloat(m[1]) : NaN; };
  const tables: Record<string, { M: number[]; T: number[] }> = {};
  const secRe = /(IV|VIII)\.(\d+)\)\s*([^\n]+)\n[-\s]*\n[\s\S]*?\n((?:\|\s*0\.\d[^\n]*\n){6})/g;
  let m: RegExpExecArray | null;
  while ((m = secRe.exec(t))) {
    const rows = m[4].trim().split("\n").map(r => r.split("|").map(s => s.trim()).filter(Boolean).map(Number));
    tables[`${m[1]}.${m[2]}`] = { M: rows.map(r => r[1]), T: rows.map(r => r[2]) };
  }
  const kmoy: Record<string, number[]> = {}, cp: Record<string, number[]> = {};
  const blk = (title: string) => t.split(title)[1].split("\n \n")[0];
  for (const [title, store] of [["VII.2)", kmoy], ["VII.3)", cp]] as const) {
    for (const line of t.split(title)[1].split("VIII)")[0].split(title === "VII.2)" ? "VII.3)" : "VIII)")[0].split("\n")) {
      const mm = line.match(/^\|([^|]+?)\s*\|\s*([-\d.]+)\|\s*([-\d.]+)\|\s*([-\d.]+)\|/);
      if (mm) store[mm[1].trim()] = [+mm[2], +mm[3], +mm[4]];
    }
  }
  const elu = [...t.split("IX.1)")[1].split("IX.2)")[0].matchAll(/\|\s*(0\.\d)\s*\|\s*([-\d.]+)\s*\|\s*(\S+)\s*\|\s*([-\d.]+)\s*\|\s*(\S+)\s*\|/g)].map(r => ({ M: +r[2], cm: r[3], T: +r[4], ct: r[5] }));
  const els = [...t.split("IX.2)")[1].split("X)")[0].matchAll(/\|\s*(0\.\d)\s*\|\s*([-\d.]+)\s*\|\s*(\S+)\s*\|\s*([-\d.]+)\s*\|\s*(\S+)\s*\|/g)].map(r => ({ M: +r[2], cm: r[3], T: +r[4], ct: r[5] }));
  const ktab = t.split("VII.1)")[1].split("VII.2)")[0].split("\n").filter(l => /^\|\s*(0|b|b\/4|b\/2|3b\/4)\s*\|/.test(l)).map(l => l.split("|").slice(2, 11).map(Number));
  return {
    t, tables, kmoy, cp, elu, els, ktab,
    Spoutre: num(/Surface de la poutre sur appuis\s*=\s*([\d.]+)/), Vpoutre: num(/Volume de la poutre\s*=\s*([\d.]+)/),
    P1: num(/tablier \(P1\)\s*=\s*([\d.]+)/), Went: num(/Poids des entretoises\s*=\s*([\d.]+)/), Wtravee: num(/Poids de la travée\s*=\s*([\d.]+)/),
    I: num(/Moment d'inertie \/ GX\s*=\s*([\d.]+)/), theta: num(/Theta =\s*([\d.]+)/), alpha: num(/Paramètre de torsion\s*=\s*([\d.]+)/), Kt: num(/inertie de torsion de la poutre\s*=\s*([\d.]+)/),
    dyn: [...t.matchAll(/Chargement (Bc 1 file|Bc 2 files|Br|Bt 1 tandem|Bt 2 tandems|Mc120|Me120)\s*:\s*([\d.]+)/g)].map(r => +r[2]),
  };
}
