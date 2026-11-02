// Words that must never appear by accident in a grid, in any direction.
//
// Stored ROT13-encoded so the list doesn't read as a wall of offensive words
// when browsing the source. To decode: A<->N, B<->O, ... (e.g. "UNGR" = "HATE").
// Also includes a few words that are simply unkind to find in a hospital
// (e.g. death, killing). Add to it freely.

const ENCODED = `
  NFF NEFR NANY NAHF OVGPU OBBO OBBOF OHGG PBPX PENC PHZ PHAG QNZA QVPX
  QVYQB QLXR SNT SNTTBG SNEG SHPX SHX SPX SHD SHPXRE UBZB WVMM XXX ANMV
  AVT AVTTRE AVTTN CRR CRAVF CVFF CBB CBBC CBEA CEVPX CHOR CHFFL ENCR
  FRK FRKL FUNT FUVG FYHG FZHG FCNM GVG GVGF GJNG INTVAN JNAX JNAXRE
  JUBER JGS KKK OBARE PYVG PBBA TBBX FCVP PUVAX QNTB JBC CBBS CBBSGRE
  OBYYBPXF OHTTRE JBT NOB OBBAT YRFOB GHEQ URYY ONFGNEQ FPEBGHZ GRFGRF
  BETNFZ UBEAL AHQR ANXRQ XVYY QVR QRNQ UNGR
`;

function rot13(s) {
  return s.replace(/[A-Z]/g, (ch) => String.fromCharCode(((ch.charCodeAt(0) - 65 + 13) % 26) + 65));
}

export const BLOCKLIST = ENCODED.trim().split(/\s+/).map(rot13);

/**
 * Find blocked words inside `line` (also reads it backwards).
 * Returns [{ start, end }] as indexes into `line` (end exclusive).
 */
export function findBlocked(line) {
  const hits = [];
  const n = line.length;
  const rev = line.split('').reverse().join('');
  for (const w of BLOCKLIST) {
    let i = line.indexOf(w);
    while (i !== -1) { hits.push({ start: i, end: i + w.length }); i = line.indexOf(w, i + 1); }
    let j = rev.indexOf(w);
    while (j !== -1) { hits.push({ start: n - j - w.length, end: n - j }); j = rev.indexOf(w, j + 1); }
  }
  return hits;
}

/** True if `text` (letters only) contains a blocked word forwards or backwards. */
export function containsBlocked(text) {
  return findBlocked(text.toUpperCase().replace(/[^A-Z]/g, '')).length > 0;
}
