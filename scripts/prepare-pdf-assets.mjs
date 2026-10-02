import {cp,mkdir} from 'node:fs/promises';
const root=new URL('../frontend/',import.meta.url);
await mkdir(new URL('public/',root),{recursive:true});
for(const [from,to] of [['cmaps','pdf-cmaps'],['standard_fonts','pdf-fonts']])await cp(new URL('node_modules/pdfjs-dist/'+from,root),new URL('public/'+to,root),{recursive:true});
console.log('Local PDF CMaps and fonts prepared.');
