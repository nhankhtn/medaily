# Brand marks

The logo shown beside an account of that type, cropped to the symbol so it
reads at 32px. Each file is the brand's own mark, used here to label my own
account — nothing in this app claims to be any of these companies.

| File       | Source                                          | Licence            |
| ---------- | ----------------------------------------------- | ------------------ |
| `bidv.svg` | Wikimedia Commons, _Logo Bidv mới.svg_          | Public domain      |
| `vcb.svg`  | Wikimedia Commons, _Vietcombank logo fixed.svg_ | CC BY-SA 4.0       |
| `vib.png`  | Wikimedia Commons, _LOGO-VIB-Blue.png_          | Public domain      |
| `momo.png` | momo.vn, the site's own 180px app icon          | © M_Service (MoMo) |

The two SVGs are the upstream files with the `viewBox` narrowed to the symbol;
the paths are untouched. The PNGs are cropped and resized to 128px.

To add another: drop the file here and add a line to `BRANDS` in
`src/features/finance/account-icon.tsx`.
