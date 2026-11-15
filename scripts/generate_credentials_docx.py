import json
import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

def set_cell_shading(cell, color_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_cell_border(cell, **kwargs):
    """
    kwargs: top, bottom, left, right
    values: dict(sz=12, val='single', color='FF0000', space='0')
    """
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(f'<w:tcBorders {nsdecls("w")}/>')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = f'<w:{edge} {nsdecls("w")} w:val="{edge_data.get("val", "single")}" w:sz="{edge_data.get("sz", 4)}" w:space="0" w:color="{edge_data.get("color", "auto")}"/>'
            tcBorders.append(parse_xml(tag))
    tcPr.append(tcBorders)

def generate_docx(json_path, output_docx_path):
    with open(json_path, "r", encoding="utf-8") as f:
        credentials = json.load(f)

    doc = docx.Document()

    # Set Margins (0.75 inch)
    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # ── Header Banner ──
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title.add_run("DAFTAR KREDENSIAL AKUN RESPONDEN")
    title_run.font.name = "Arial"
    title_run.font.size = Pt(18)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A) # Deep Navy

    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = sub.add_run("SIMULASI TRADING PASAR SAHAM (SIMVEST)\nhttps://simvest.site")
    sub_run.font.name = "Arial"
    sub_run.font.size = Pt(11)
    sub_run.font.bold = True
    sub_run.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta_run = meta.add_run(f"Total Akun: {len(credentials)} Responden  •  Format Password: 4 Digit Angka Unik (Non-Guessable)  •  Status: Aktif")
    meta_run.font.name = "Arial"
    meta_run.font.size = Pt(9.5)
    meta_run.font.italic = True
    meta_run.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

    doc.add_paragraph() # Spacer

    # ── Petunjuk Penting ──
    info_box = doc.add_paragraph()
    info_run1 = info_box.add_run("Petunjuk Peneliti & Administrator:\n")
    info_run1.font.bold = True
    info_run1.font.size = Pt(10)
    info_run1.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    info_text = (
        "1. Setiap responden (responden1 s.d responden100) memiliki Password berupa 4 Digit Angka yang unik dan berbeda satu sama lain.\n"
        "2. Seluruh akun telah terdaftar di database dengan saldo awal masing-masing Rp 100.000.000,00 dan portofolio awal 10 lot per saham.\n"
        "3. Bagian 1 dokumen ini memuat Tabel Master untuk arsip peneliti / absensi kehadiran responden.\n"
        "4. Bagian 2 dokumen ini memuat Slip / Kartu Meja Siap Gunting yang dapat dibagikan langsung kepada responden saat sesi simulasi."
    )
    info_run2 = info_box.add_run(info_text)
    info_run2.font.size = Pt(9)
    info_run2.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

    doc.add_paragraph() # Spacer

    # ── BAGIAN 1: TABEL MASTER ARSIP PENELITI ──
    h1 = doc.add_paragraph()
    h1_run = h1.add_run("BAGIAN 1: TABEL MASTER KREDENSIAL (ARSIP PENELITI)")
    h1_run.font.name = "Arial"
    h1_run.font.size = Pt(12)
    h1_run.font.bold = True
    h1_run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    table = doc.add_table(rows=1, cols=6)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    # Header Row
    headers = ["No.", "Username", "PIN (Password)", "Peran", "Saldo Awal", "Paraf / Nama Peserta"]
    col_widths = [Inches(0.5), Inches(1.3), Inches(1.3), Inches(1.0), Inches(1.4), Inches(1.5)]

    hdr_cells = table.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].text = title
        hdr_cells[i].width = col_widths[i]
        set_cell_shading(hdr_cells[i], "1E3A8A") # Navy
        set_cell_margins(hdr_cells[i], top=140, bottom=140, left=100, right=100)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in p.runs:
            run.font.name = "Arial"
            run.font.size = Pt(9)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)

    # Data Rows
    for idx, c in enumerate(credentials):
        row_cells = table.add_row().cells
        bg_color = "F3F4F6" if idx % 2 == 1 else "FFFFFF"

        values = [
            str(c["nomor"]),
            c["username"],
            c["pin"],
            "Responden",
            f"Rp {c['saldo']}",
            ""
        ]

        for i, val in enumerate(values):
            row_cells[i].width = col_widths[i]
            row_cells[i].text = val
            set_cell_shading(row_cells[i], bg_color)
            set_cell_margins(row_cells[i], top=90, bottom=90, left=100, right=100)
            p = row_cells[i].paragraphs[0]
            
            # Alignments
            if i in [0, 2, 3]:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif i in [1]:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            elif i in [4]:
                p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            else:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT

            for run in p.runs:
                run.font.name = "Consolas" if i in [1, 2] else "Arial"
                run.font.size = Pt(9.5 if i == 2 else 8.5)
                if i == 2:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(0x04, 0x78, 0x57) # Emerald Dark
                elif i == 1:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    # ── BAGIAN 2: SLIP / KARTU MEJA SIAP CETAK ──
    doc.add_page_break()

    h2 = doc.add_paragraph()
    h2_run = h2.add_run("BAGIAN 2: KARTU MEJA / SLIP KREDENSIAL PESERTA (SIAP GUNTING)")
    h2_run.font.name = "Arial"
    h2_run.font.size = Pt(13)
    h2_run.font.bold = True
    h2_run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

    desc2 = doc.add_paragraph()
    desc2_run = desc2.add_run("Gunting kartu di bawah ini dan letakkan pada masing-masing meja responden sebelum simulasi dimulai.")
    desc2_run.font.size = Pt(9)
    desc2_run.font.italic = True
    desc2_run.font.color.rgb = RGBColor(0x4B, 0x55, 0x63)

    # 2 Cards per row
    card_table = doc.add_table(rows=0, cols=2)
    card_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    card_col_width = Inches(3.4)

    card_border = dict(val="dashed", sz=6, color="9CA3AF")

    for i in range(0, len(credentials), 2):
        row = card_table.add_row()
        for col_idx in range(2):
            card_idx = i + col_idx
            cell = row.cells[col_idx]
            cell.width = card_col_width

            if card_idx < len(credentials):
                c = credentials[card_idx]
                set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
                set_cell_border(cell, top=card_border, bottom=card_border, left=card_border, right=card_border)
                set_cell_shading(cell, "F9FAFB")

                p1 = cell.paragraphs[0]
                p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_title = p1.add_run("SIMVEST - SIMULASI TRADING")
                r_title.font.name = "Arial"
                r_title.font.size = Pt(10)
                r_title.font.bold = True
                r_title.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)

                p_site = cell.add_paragraph()
                p_site.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_site = p_site.add_run("https://simvest.site")
                r_site.font.size = Pt(7.5)
                r_site.font.color.rgb = RGBColor(0x6B, 0x72, 0x80)

                # Divider
                p_div = cell.add_paragraph()
                p_div.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_div = p_div.add_run("─────────────────────────")
                r_div.font.size = Pt(6)
                r_div.font.color.rgb = RGBColor(0x9C, 0xA3, 0xAF)

                p_user = cell.add_paragraph()
                p_user.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r_ulabel = p_user.add_run("Nomor Meja / ID  : ")
                r_ulabel.font.size = Pt(8.5)
                r_ulabel.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
                r_uval = p_user.add_run(f"No. {c['nomor']:02d} ({c['username']})")
                r_uval.font.size = Pt(9.5)
                r_uval.font.bold = True
                r_uval.font.name = "Consolas"

                p_pin = cell.add_paragraph()
                p_pin.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r_plabel = p_pin.add_run("PIN Password     : ")
                r_plabel.font.size = Pt(8.5)
                r_plabel.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
                r_pval = p_pin.add_run(c['pin'])
                r_pval.font.size = Pt(13)
                r_pval.font.bold = True
                r_pval.font.name = "Consolas"
                r_pval.font.color.rgb = RGBColor(0x04, 0x78, 0x57) # Green Bold

                p_saldo = cell.add_paragraph()
                p_saldo.alignment = WD_ALIGN_PARAGRAPH.LEFT
                r_slabel = p_saldo.add_run("Saldo Awal Kas   : ")
                r_slabel.font.size = Pt(8.5)
                r_slabel.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
                r_sval = p_saldo.add_run(f"Rp {c['saldo']}")
                r_sval.font.size = Pt(8.5)
                r_sval.font.bold = True

                p_warn = cell.add_paragraph()
                p_warn.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r_warn = p_warn.add_run("⚠️ Jaga kerahasiaan PIN ini dari peserta lain.")
                r_warn.font.size = Pt(7.5)
                r_warn.font.italic = True
                r_warn.font.color.rgb = RGBColor(0xDC, 0x26, 0x26)
            else:
                set_cell_shading(cell, "FFFFFF")

    doc.save(output_docx_path)
    print(f"Berhasil membuat dokumen: {output_docx_path}")

if __name__ == "__main__":
    json_input = sys.argv[1] if len(sys.argv) > 1 else "src/db/respondent-credentials.json"
    docx_output = sys.argv[2] if len(sys.argv) > 2 else "Daftar_Kredensial_Responden_1-100.docx"
    generate_docx(json_input, docx_output)

