from __future__ import annotations

import hashlib
import json
import os
import re
import textwrap
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output"
DOCX_DIR = OUT / "docx"
PDF_DIR = OUT / "pdf"
EVID = OUT / "evidence"
SCREEN = EVID / "screenshots"
DIAGRAMS = EVID / "diagrams"
DOCX_PATH = DOCX_DIR / "PeAS_System_Documentation.docx"

GREEN = RGBColor(31, 78, 58)
GOLD = RGBColor(166, 124, 0)
INK = RGBColor(30, 30, 30)
MUTED = RGBColor(90, 90, 90)
LIGHT = "EAF2ED"
PALE = "F7F5EF"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def set_cell_shading(cell, fill: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=80, start=100, bottom=80, end=100):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement("w:tcMar")
        tcPr.append(tcMar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tcMar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tcMar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    trPr = row._tr.get_or_add_trPr()
    tblHeader = OxmlElement("w:tblHeader")
    tblHeader.set(qn("w:val"), "true")
    trPr.append(tblHeader)


def prevent_row_split(row):
    trPr = row._tr.get_or_add_trPr()
    cantSplit = OxmlElement("w:cantSplit")
    trPr.append(cantSplit)


def set_table_borders(table, color="C7D0C8", size="6"):
    tbl = table._tbl
    tblPr = tbl.tblPr
    borders = tblPr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tblPr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def add_page_field(paragraph, fmt="ARABIC"):
    run = paragraph.add_run()
    fldChar1 = OxmlElement("w:fldChar")
    fldChar1.set(qn("w:fldCharType"), "begin")
    instrText = OxmlElement("w:instrText")
    instrText.set(qn("xml:space"), "preserve")
    instrText.text = " PAGE " if fmt == "ARABIC" else " PAGE \\* ROMAN "
    fldChar2 = OxmlElement("w:fldChar")
    fldChar2.set(qn("w:fldCharType"), "end")
    run._r.append(fldChar1)
    run._r.append(instrText)
    run._r.append(fldChar2)


def add_field(paragraph, instruction):
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = instruction
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    placeholder = OxmlElement("w:t")
    placeholder.text = "Updating…"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for el in (begin, instr, separate, placeholder, end):
        run._r.append(el)


def configure_styles(doc: Document):
    sec = doc.sections[0]
    sec.page_width = Inches(8.5)
    sec.page_height = Inches(11)
    sec.top_margin = Inches(1)
    sec.bottom_margin = Inches(0.85)
    sec.left_margin = Inches(1)
    sec.right_margin = Inches(1)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Times New Roman"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
    normal.font.size = Pt(12)
    normal.font.color.rgb = INK
    normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.widow_control = True
    for name, size, color, before, after in (
        ("Title", 22, GREEN, 0, 18),
        ("Heading 1", 16, GREEN, 18, 8),
        ("Heading 2", 14, GREEN, 12, 6),
        ("Heading 3", 12, GOLD, 8, 4),
    ):
        st = styles[name]
        st.font.name = "Times New Roman"
        st._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = color
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True
        st.paragraph_format.widow_control = True
    for name in ("Caption", "Intense Quote"):
        st = styles[name]
        st.font.name = "Times New Roman"
        st._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
        st.font.size = Pt(10)
        st.font.italic = True if name == "Caption" else False
        st.font.color.rgb = MUTED
        st.paragraph_format.line_spacing = 1.0
    for name in ("List Bullet", "List Number"):
        st = styles[name]
        st.font.name = "Times New Roman"
        st._element.rPr.rFonts.set(qn("w:eastAsia"), "Times New Roman")
        st.font.size = Pt(12)
        st.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
        st.paragraph_format.left_indent = Inches(0.28)
        st.paragraph_format.first_line_indent = Inches(-0.18)


def set_page_number_format(section, fmt="decimal", start=1):
    sectPr = section._sectPr
    pgNumType = sectPr.find(qn("w:pgNumType"))
    if pgNumType is None:
        pgNumType = OxmlElement("w:pgNumType")
        sectPr.append(pgNumType)
    pgNumType.set(qn("w:fmt"), fmt)
    pgNumType.set(qn("w:start"), str(start))


def add_footer(section, label="PeAS System Documentation", roman=False):
    footer = section.footer
    p = footer.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.style = "Caption"
    p.add_run(label + "  •  ")
    add_page_field(p, "ROMAN" if roman else "ARABIC")


def add_heading(doc, text, level=1):
    return doc.add_heading(text, level=level)


def add_para(doc, text="", style=None, align=None, italic=False, bold=False):
    p = doc.add_paragraph(style=style)
    if align is not None:
        p.alignment = align
    if text:
        r = p.add_run(text)
        r.italic = italic
        r.bold = bold
    return p


def add_bullets(doc, items, numbered=False):
    for item in items:
        p = doc.add_paragraph(style="List Number" if numbered else "List Bullet")
        p.add_run(item)


def add_table(doc, headers, rows, widths=None, font_size=9):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    set_table_borders(table)
    hdr = table.rows[0]
    set_repeat_table_header(hdr)
    for i, h in enumerate(headers):
        c = hdr.cells[i]
        set_cell_shading(c, LIGHT)
        set_cell_margins(c)
        c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        p = c.paragraphs[0]
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(str(h))
        r.bold = True
        r.font.name = "Times New Roman"
        r.font.size = Pt(font_size)
    for row_data in rows:
        row = table.add_row()
        prevent_row_split(row)
        for i, val in enumerate(row_data):
            c = row.cells[i]
            set_cell_margins(c)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            p = c.paragraphs[0]
            p.paragraph_format.line_spacing = 1.0
            p.paragraph_format.space_after = Pt(0)
            r = p.add_run(str(val))
            r.font.name = "Times New Roman"
            r.font.size = Pt(font_size)
    if widths:
        for row in table.rows:
            for idx, width in enumerate(widths):
                row.cells[idx].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def add_caption(doc, text):
    p = doc.add_paragraph(style="Caption")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(text)


def add_picture_with_caption(doc, path: Path, caption: str, width=6.35):
    if path.exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.add_run().add_picture(str(path), width=Inches(width))
        add_caption(doc, caption)
    else:
        add_para(doc, f"[Evidence image unavailable at assembly time: {path.name}]", italic=True)


def section_break(doc, landscape=False):
    sec = doc.add_section()
    sec.top_margin = Inches(0.75 if landscape else 1)
    sec.bottom_margin = Inches(0.75 if landscape else 0.85)
    sec.left_margin = Inches(0.65 if landscape else 1)
    sec.right_margin = Inches(0.65 if landscape else 1)
    if landscape:
        sec.orientation = WD_ORIENT.LANDSCAPE
        sec.page_width, sec.page_height = Inches(11), Inches(8.5)
    else:
        sec.orientation = WD_ORIENT.PORTRAIT
        sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    add_footer(sec)
    return sec


def font_for(size=30, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    if bold:
        candidates = ["/System/Library/Fonts/Supplemental/Arial Bold.ttf"] + candidates
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()


def wrap_text(draw, text, font, width):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        test = f"{cur} {word}".strip()
        if draw.textbbox((0, 0), test, font=font)[2] <= width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def draw_box(draw, xy, title, body="", fill="#EAF2ED", stroke="#1F4E3A", title_size=28):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle(xy, radius=24, fill=fill, outline=stroke, width=4)
    tf = font_for(title_size, True)
    bf = font_for(max(19, title_size - 7))
    draw.text((x1 + 22, y1 + 18), title, font=tf, fill="#1E1E1E")
    y = y1 + 18 + title_size + 14
    for line in wrap_text(draw, body, bf, x2 - x1 - 44)[:6]:
        draw.text((x1 + 22, y), line, font=bf, fill="#3B3B3B")
        y += max(24, title_size - 2)


def arrow(draw, a, b, color="#A67C00", width=6):
    draw.line((a[0], a[1], b[0], b[1]), fill=color, width=width)
    import math
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    head = 18
    left = (b[0] - head * math.cos(ang - 0.55), b[1] - head * math.sin(ang - 0.55))
    right = (b[0] - head * math.cos(ang + 0.55), b[1] - head * math.sin(ang + 0.55))
    draw.polygon([b, left, right], fill=color)


def make_diagrams():
    DIAGRAMS.mkdir(parents=True, exist_ok=True)
    W, H = 2200, 1350
    # Context diagram
    im = Image.new("RGB", (W, H), "#FFFFFF")
    d = ImageDraw.Draw(im)
    d.text((80, 45), "PeAS system context", font=font_for(52, True), fill="#1F4E3A")
    draw_box(d, (700, 460, 1500, 880), "PeAS repository", "Public discovery, reader accounts, publishing, governance, reporting, and configurable experience", "#EAF2ED")
    boxes = [
        ((90, 230, 600, 430), "Public visitor", "Search, browse, preview, contact"),
        ((90, 930, 600, 1130), "Registered user", "Read, save, history, annotations, requests"),
        ((1600, 230, 2110, 430), "Content publisher", "Submit documents and manage news"),
        ((1600, 930, 2110, 1130), "Administrator", "Review, classify, report, configure"),
    ]
    for xy, t, b in boxes:
        draw_box(d, xy, t, b, "#F7F5EF")
        cx = (xy[2] + xy[0]) // 2
        cy = (xy[3] + xy[1]) // 2
        target = (700 if cx < 700 else 1500, 650 if cy < 650 else 760)
        arrow(d, (xy[2] if cx < 700 else xy[0], cy), target)
    ext = [(790, 1030, 1120, 1210, "SMTP", "Durable notification delivery"), (1160, 1030, 1510, 1210, "Microsoft identity", "Optional Entra sign-in"), (70, 50, 430, 160, "Legend", "Green = system; cream = audience; gold = data flow")]
    for x1,y1,x2,y2,t,b in ext:
        draw_box(d, (x1,y1,x2,y2), t, b, "#F4F4F4", "#777777", 23)
    arrow(d, (1100, 880), (955, 1030)); arrow(d, (1300, 880), (1330, 1030))
    im.save(DIAGRAMS / "fig01-context.png", dpi=(220, 220))

    # Runtime/container
    im = Image.new("RGB", (W, H), "#FFFFFF"); d = ImageDraw.Draw(im)
    d.text((80, 45), "PeAS runtime/container view", font=font_for(52, True), fill="#1F4E3A")
    draw_box(d, (130, 300, 590, 900), "Browser", "Server-owned HTML shells, React admin surfaces, PDF.js reader, responsive public pages", "#F7F5EF")
    draw_box(d, (760, 170, 1450, 1030), "Deno/Oak web process", "Authentication, route handlers, capability middleware, document delivery, reporting, Experience Studio APIs", "#EAF2ED")
    draw_box(d, (1660, 150, 2080, 430), "PostgreSQL 17", "Metadata, identity, activity, workflow, reporting rollups", "#F7F5EF")
    draw_box(d, (1660, 520, 2080, 780), "Private storage", "PDF originals, WebP previews, media variants, hashes", "#F7F5EF")
    draw_box(d, (1660, 870, 2080, 1070), "Workers", "Abstract extraction and media processing", "#F7F5EF")
    arrow(d, (590, 600), (760, 600)); arrow(d, (1450, 360), (1660, 290)); arrow(d, (1450, 720), (1660, 650)); arrow(d, (1450, 880), (1660, 960))
    draw_box(d, (800, 1130, 1170, 1280), "SMTP", "Configured email", "#F4F4F4", "#777777", 23)
    draw_box(d, (1230, 1130, 1640, 1280), "Optional Entra", "Only when credentials are configured", "#F4F4F4", "#777777", 23)
    arrow(d, (970, 1030), (970, 1130)); arrow(d, (1320, 1030), (1430, 1130))
    im.save(DIAGRAMS / "fig02-runtime.png", dpi=(220, 220))

    # Lifecycle/DFD
    im = Image.new("RGB", (W, H), "#FFFFFF"); d = ImageDraw.Draw(im)
    d.text((80, 45), "Document lifecycle and level-1 repository flow", font=font_for(52, True), fill="#1F4E3A")
    steps = [(120, 450, 430, 690, "Upload", "PDF + metadata"), (520, 450, 830, 690, "Validate", "PDF, metadata, authors"), (920, 450, 1230, 690, "Review", "Admin decision"), (1320, 450, 1630, 690, "Publish", "Public discovery"), (1720, 450, 2050, 690, "Read / request", "Preview, stream, token")]
    for xy, t, b in [(s[:4],s[4],s[5]) for s in steps]: draw_box(d, xy, t, b, "#EAF2ED")
    for i in range(len(steps)-1): arrow(d, (steps[i][2], 570), (steps[i+1][0], 570))
    draw_box(d, (300, 900, 750, 1120), "Pending / rejected", "Publisher can correct and resubmit; rejected records remain auditable", "#F7F5EF")
    draw_box(d, (900, 900, 1350, 1120), "Archived / deleted", "Soft deletion and restoration preserve operational history", "#F7F5EF")
    draw_box(d, (1500, 900, 1950, 1120), "Access token", "Time-limited, revocable delivery boundary", "#F7F5EF")
    arrow(d, (1075, 690), (525, 900)); arrow(d, (1480, 690), (1125, 900)); arrow(d, (1900, 690), (1725, 900))
    im.save(DIAGRAMS / "fig03-lifecycle.png", dpi=(220, 220))

    # Auth sequence
    im = Image.new("RGB", (W, H), "#FFFFFF"); d = ImageDraw.Draw(im)
    d.text((80, 45), "Authentication and authorization sequence", font=font_for(52, True), fill="#1F4E3A")
    actors = [(180, "Browser"), (620, "Deno route"), (1050, "Session store"), (1480, "Capability middleware"), (1900, "Private file")]
    for x,t in actors:
        d.text((x-55, 150), t, font=font_for(28, True), fill="#1E1E1E")
        d.line((x, 205, x, 1140), fill="#A7B3A8", width=4)
    msgs = [(300,180,620,"request with cookie"),(360,620,1050,"resolve Better Auth session"),(430,1050,620,"user + role"),(500,620,1480,"normalize role / capability"),(570,1480,620,"allow or 401/403"),(660,620,1900,"ownership / token check"),(730,1900,620,"stream bytes; no path leak"),(820,620,180,"HTML or JSON response")]
    for y,x1,x2,label in msgs:
        arrow(d,(x1,y),(x2,y)); d.text(((x1+x2)//2-80,y-30),label,font=font_for(21),fill="#3B3B3B")
    add_note = "Protected delivery is a decision chain: session → normalized role → capability → ownership/token → file stream."
    for line in wrap_text(d, add_note, font_for(25), 1800):
        d.text((180, 1180), line, font=font_for(25), fill="#1F4E3A"); break
    im.save(DIAGRAMS / "fig04-auth-sequence.png", dpi=(220, 220))

    # ERD
    im = Image.new("RGB", (W, H), "#FFFFFF"); d = ImageDraw.Draw(im)
    d.text((80, 45), "Simplified domain ERD", font=font_for(52, True), fill="#1F4E3A")
    groups = [
        ((90, 230, 650, 600), "Identity", "users\naccounts / sessions\nroles / capabilities"),
        ((820, 230, 1400, 600), "Repository", "documents\ncompiled_documents\ndocument_authors"),
        ((1570, 230, 2110, 600), "Classification", "departments\nclassifications\ntopics / keywords"),
        ((90, 780, 650, 1150), "Reader activity", "saved_documents\nhistory / reading_status\nannotations / requests"),
        ((820, 780, 1400, 1150), "Publishing/media", "news / media_assets\nmedia_variants\nabstract_jobs"),
        ((1570, 780, 2110, 1150), "Reporting/config", "analytics rollups\ninquiries\nexperience settings"),
    ]
    for xy,t,b in groups: draw_box(d,xy,t,b,"#EAF2ED")
    links=[((650,410),(820,410)),((1400,410),(1570,410)),((650,950),(820,950)),((1400,950),(1570,950)),((370,600),(370,780)),((1110,600),(1110,780)),((1840,600),(1840,780))]
    for a,b in links: arrow(d,a,b)
    im.save(DIAGRAMS / "fig05-erd.png", dpi=(220, 220))

    # deployment
    im = Image.new("RGB", (W, H), "#FFFFFF"); d = ImageDraw.Draw(im)
    d.text((80,45), "Docker deployment view", font=font_for(52, True), fill="#1F4E3A")
    draw_box(d,(100,240,820,1040),"Docker host","Compose network; published app port 18080; named volumes for PostgreSQL and storage","#F7F5EF")
    draw_box(d,(950,180,1430,510),"app","Deno/Oak web process\nHTTP 18080","#EAF2ED")
    draw_box(d,(950,610,1430,940),"db","PostgreSQL 17\nhealth check","#EAF2ED")
    draw_box(d,(1510,180,2050,510),"abstract-worker","PDF text extraction, OCR fallback, queue state","#EAF2ED")
    draw_box(d,(1510,610,2050,940),"media-worker","FFmpeg/FFprobe and WebP variants","#EAF2ED")
    arrow(d,(820,560),(950,345)); arrow(d,(820,650),(950,775)); arrow(d,(1430,345),(1510,345)); arrow(d,(1430,775),(1510,775))
    draw_box(d,(930,1060,1360,1210),"SMTP","External email endpoint", "#F4F4F4", "#777777", 23)
    draw_box(d,(1450,1060,2010,1210),"Optional Microsoft identity","External connection only when configured", "#F4F4F4", "#777777", 23)
    arrow(d,(1160,940),(1140,1060)); arrow(d,(1730,940),(1730,1060))
    im.save(DIAGRAMS / "fig06-deployment.png", dpi=(220,220))


def add_title_page(doc):
    for _ in range(4): doc.add_paragraph()
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run("CAPSTONE PROJECT").bold = True
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Paulinian electronic Archiving System\n(PeAS)"); r.bold = True; r.font.size = Pt(22); r.font.color.rgb = GREEN
    for _ in range(2): doc.add_paragraph()
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.add_run("Prepared by:").bold = True
    for author in ("Christian James B. Anadon", "James Dale A. Grafe", "Kurt Dustine L. Yrad"):
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.add_run(author)
    for _ in range(2): doc.add_paragraph()
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.add_run("Advisor:").bold = True
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.add_run("Ms. Grace L. Alejado, MIT")
    for _ in range(2): doc.add_paragraph()
    for line in ("St. Paul University Dumaguete", "Bachelor of Science in Information Technology"):
        p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.add_run(line)
    # The title page has no visible number. Start front matter in a new section
    # so its footer can use lower-case Roman numerals independently.
    first = doc.sections[0]
    first.footer.paragraphs[0]._element.clear_content()
    front = doc.add_section(WD_SECTION.NEW_PAGE)
    front.footer.is_linked_to_previous = False
    add_footer(front, roman=True)
    set_page_number_format(front, "lowerRoman", 1)


def add_front_matter(doc, control):
    add_heading(doc, "Document Control", 1)
    add_para(doc, "This page fixes the evidence boundary for this edition. The manuscript describes the current working tree as observed before documentation artifacts were generated; it does not rewrite or normalize application source code.")
    add_table(doc, ["Field", "Recorded value"], [
        ("Document status", "Submission-ready draft master; editable Word source"),
        ("Version", "1.0 (as-built documentation baseline)"),
        ("Code commit", control["commit"]),
        ("Branch", control["branch"]),
        ("Working tree", "Clean before documentation artifacts; output/ is generated and untracked"),
        ("Preparation time", control["generated"]),
        ("Source PDF SHA-256", control["source_pdf"]),
        ("Evidence policy", "Executable source, schema, migrations, tests, and running application outrank the legacy PDF"),
        ("Authorship", "Christian James B. Anadon; James Dale A. Grafe; Kurt Dustine L. Yrad"),
    ], [1.6, 4.9], 9)
    add_para(doc, "Baseline hashes are retained in output/evidence/baseline.txt. Browser screenshots in this edition use disposable synthetic accounts and data; they are not production records.")
    add_heading(doc, "Executive Abstract", 1)
    add_para(doc, "PeAS is a web-based academic-output repository for St. Paul University Dumaguete. It brings together public discovery, registered-reader tools, publisher submission, administrator governance, controlled document delivery, news publishing, inquiries, operational reporting, and Experience Studio configuration in one application. The current implementation is a React/Vite interface served through server-owned HTML shells, a Deno/Oak backend, PostgreSQL 17, Better Auth session management, Docker Compose deployment, private file storage, and background workers for abstract and media processing. PostgreSQL metadata search and autocomplete are the active retrieval path; Meilisearch remains an explicit extension point rather than an installed runtime dependency.")
    add_para(doc, "This documentation reconciles the legacy capstone draft with the as-built system. Claims are classified as Implemented, Configuration-gated, Planned, Deprecated/compatibility, or Legacy draft only. The evidence baseline records commit 143caa0, the source PDF hash, principal source-file hashes, database-backed checks, type checks, unit results, browser evidence, and the current deployment state. The Deno unit suite reported 101 passed and 0 failed; reporting and classification database fixtures passed on isolated test databases; Experience Studio smoke checks passed on desktop and mobile. Supported Chromium browser projects supplied functional evidence, while WebKit was not available in the local Playwright installation and several existing UI assertions remain documented limitations rather than being silently corrected.")
    add_para(doc, "The system reduces the operational risks of paper and fragmented repositories by normalizing metadata, retaining workflow state, separating public discovery from protected delivery, recording reader activity with privacy-aware aggregates, and giving staff searchable reports and exports. It does not claim legal compliance, permanent preservation, external-library federation, predictive analytics, or production Meilisearch integration. The appendices provide traceability, role and capability boundaries, operation guides, API and data references, deployment guidance, test scripts, screenshot provenance, feature status, and documentation maintenance checks.")
    add_heading(doc, "Table of Contents", 1)
    add_para(doc, "This snapshot is generated from the structured Word heading hierarchy. In Word, the headings can be used to refresh a fully automatic table of contents (Ctrl+A, F9); the PDF embeds the readable snapshot so the submission copy remains self-contained.", italic=True)
    add_table(doc, ["Section", "Page"], [
        ("Summary", "1"), ("Background of the Study", "3"), ("Problem Statement", "4"), ("Objectives", "5"),
        ("Scope and Delimitations", "7"), ("Significance of the Study", "8"), ("Existing Archiving Systems", "8"),
        ("Technologies Used", "9"), ("Theoretical and Conceptual Framework", "10"), ("Development Process", "12"),
        ("System Architecture and Implementation", "12"), ("Implementation Details", "16"),
        ("Testing and Evaluation", "28"), ("Screenshots of PeAS in Action", "29"), ("References", "42"),
        ("Appendices A–J", "44–91"),
    ], [5.5, 1.0], 9)
    add_heading(doc, "List of Figures", 1)
    add_table(doc, ["Figure", "Title", "Page"], [
        ("1", "PeAS system context", "13"), ("2", "Runtime/container view", "14"),
        ("3", "Document lifecycle and level-1 repository flow", "15"), ("4", "Authentication and authorization sequence", "16"),
        ("5", "Simplified domain ERD", "16"), ("6", "Docker deployment view", "17"),
        ("7–17", "Screenshots of PeAS in action", "35–42"),
    ], [0.65, 4.9, 0.95], 9)
    doc.add_page_break()
    add_heading(doc, "List of Tables", 1)
    add_table(doc, ["Table group", "Contents"], [
        ("Document control", "Baseline, hashes, status, authorship"), ("Problem/objective traceability", "PRB-01–06 and OBJ-01–10"),
        ("Technology decisions", "Stack, purpose, status, constraints"), ("Role/capability matrix", "Audience, ownership, backend enforcement"),
        ("API inventory", "Method, path, audience, capability, privacy, evidence"), ("Data dictionary", "Domain, table, columns, purpose, retention"),
        ("Test evidence", "Command, result, limitation"), ("Feature status", "Implemented, gated, planned, deprecated, legacy"),
    ], [1.9, 4.6], 9)
    doc.add_page_break()
    add_heading(doc, "Abbreviations and Terminology", 1)
    add_table(doc, ["Term", "Meaning in this document"], [
        ("ACL", "Access-control list; document-level depth is a future design decision beyond broad role enforcement."),
        ("API", "Application programming interface exposed by the Deno/Oak server."),
        ("DFD", "Data-flow diagram."), ("Dublin Core", "Metadata vocabulary used as a conceptual comparison for repository fields."),
        ("ERD", "Entity–relationship diagram."), ("HLS", "HTTP Live Streaming; relevant to media processing boundaries, not a claim that PeAS streams HLS."),
        ("OCR", "Optical character recognition; fallback in abstract extraction."), ("OAIS", "Open Archival Information System reference model; conceptual guidance, not certification."),
        ("PDF", "Portable Document Format."), ("RBAC", "Role-based access control."), ("SPUD", "St. Paul University Dumaguete."),
        ("SMTP", "Simple Mail Transfer Protocol."), ("UAT", "User acceptance testing."), ("WebP", "Image format used for guest preview and media variants."),
    ], [1.5, 5.0], 9)
    body = doc.add_section(WD_SECTION.NEW_PAGE)
    body.footer.is_linked_to_previous = False
    add_footer(body)
    set_page_number_format(body, "decimal", 1)


def add_summary_sections(doc):
    add_heading(doc, "Summary", 1)
    add_heading(doc, "System Description", 2)
    add_para(doc, "PeAS is an academic-output repository, not a generic file share. Its data model separates document records, authors, departments, classifications, topics, keywords, compiled works, reader activity, publishing, inquiries, reports, and configurable content. Public visitors can discover approved material and view guest-friendly previews. Registered users receive a session-bound reader experience and private activity features. Content publishers work within a constrained news and submission workspace. Administrators own review, governance, reporting, reference data, role management, access requests, and Experience Studio.")
    add_heading(doc, "Current Problem Addressed", 2)
    add_para(doc, "SPUD’s academic outputs can become difficult to discover and govern when paper records, scattered files, inconsistent metadata, and informal requests coexist. PeAS responds with a searchable catalog, normalized reference data, a review and publication state machine, controlled streaming, time-limited access tokens, staff reporting, and auditable operations. These are risk-reduction measures; they do not create a guarantee of permanent preservation or legal compliance.")
    add_heading(doc, "Objectives and Methods", 2)
    add_para(doc, "The general objective is to provide an accessible, searchable, and governed digital repository for SPUD academic outputs. Specific objectives are stated as measurable system behaviors in the traceability appendix. Development evidence comes from the working tree, migrations, route and middleware source, test suites, Docker services, and current UI captures. The documentation workflow itself used a claim ledger and status vocabulary so that unsupported legacy prose could not pass as implementation evidence.")
    add_heading(doc, "Key Findings", 2)
    add_bullets(doc, [
        "The application runs as a React/Vite front end with server-owned HTML shells and a Deno/Oak backend backed by PostgreSQL 17.",
        "Better Auth sessions and backend capability middleware enforce the four-audience model: public visitor, registered user, content publisher, and administrator.",
        "PostgreSQL-backed search, autocomplete, filters, and privacy-preserving aggregate analytics are current; Meilisearch is planned.",
        "PDF preview and protected delivery are distinct paths: guest WebP preview is separated from authenticated PDF.js reading and time-limited request tokens.",
        "Type checks, the Deno unit suite, reporting database fixtures, classification fixtures, and Experience Studio smoke tests provide reproducible evidence; browser limitations are recorded rather than hidden.",
    ])
    add_heading(doc, "Implementation Boundary and Future Enhancements", 2)
    add_para(doc, "Future work includes a production Meilisearch adapter, deeper document-level ACL policy, richer preservation policy and restore drills, optional external identity and storage integrations, and expanded browser coverage where missing engines can be installed. These items are not presented as completed functionality.")

    add_heading(doc, "Background of the Study", 1)
    add_heading(doc, "SPUD Academic Archiving Context", 2)
    add_para(doc, "Academic offices produce theses, dissertations, compiled research records, Confluence outputs, Synergy records, news, and supporting media. Their value is both scholarly and operational: students need discoverability, researchers need trustworthy metadata, staff need workflow visibility, and administrators need control over access and reporting. A repository therefore has to connect descriptive metadata to file delivery without exposing private storage paths or internal identifiers.")
    add_heading(doc, "Risks of Paper and Fragmented Repositories", 2)
    add_para(doc, "Paper-only and fragmented arrangements create predictable risks: duplicated data entry, inconsistent titles and names, slow retrieval, unclear ownership, and weak evidence of who approved or accessed a record. PeAS addresses those risks through controlled vocabulary tables, source hashes, state transitions, durable notification jobs, and operational rollups. The design is deliberately cautious about what it promises: it improves the workflow, but it is not itself a preservation policy or an institutional records schedule.")
    add_heading(doc, "Metadata, Controlled Access, and Retrieval", 2)
    add_para(doc, "Metadata is the bridge between a file and a usable repository. PeAS normalizes authors, departments, research agenda codes, classifications, topics, and keywords, and validates the document type and PDF boundary before publication. Public discovery is intentionally broader than protected delivery: the catalog can expose approved descriptive information while the bytes remain behind session, ownership, or token checks. This separation follows least-privilege principles and supports both guest preview and authenticated reading.")
    add_heading(doc, "Institutional Rationale", 2)
    add_para(doc, "PeAS gives SPUD a single institution-specific workflow for academic outputs while retaining the flexibility to evolve its search, storage, identity, and reporting adapters. The rationale is practical: staff can review and classify records, readers can find and save material, publishers can manage news, and administrators can inspect activity without treating a legacy description as a substitute for current evidence.")

    add_heading(doc, "Problem Statement", 1)
    add_para(doc, "The central problem is the absence of a unified, evidence-governed repository workflow for SPUD academic outputs. The supporting problems are separated below so that each can be traced to an implemented response or a declared future boundary.")
    add_table(doc, ["Problem ID", "Observed problem", "PeAS response", "Status"], [
        ("PRB-01", "Academic outputs are difficult to find when metadata and files are fragmented.", "Normalized catalog, PostgreSQL search, autocomplete, filters, author and classification pages.", "Implemented"),
        ("PRB-02", "Paper or ad-hoc files do not provide a dependable review and publication trail.", "Upload validation, review states, soft deletion, restoration, and audit-oriented workflow fields.", "Implemented"),
        ("PRB-03", "Public discovery and protected files are easy to conflate.", "Guest WebP preview, authenticated streaming, access requests, and expiring tokens.", "Implemented"),
        ("PRB-04", "Inconsistent classification weakens retrieval and reporting.", "Reference data, classification transaction service, agendas, topics, keywords, and database checks.", "Implemented"),
        ("PRB-05", "Staff lack a single operational view of activity and requests.", "Manila-aligned reporting windows, rollups, exports, inquiries, and top-activity detail.", "Implemented"),
        ("PRB-06", "Search scale and deep item ACL policy remain open design decisions.", "PostgreSQL current path; Meilisearch and deeper ACL depth retained as future work.", "Future"),
    ], [0.65, 2.25, 2.85, 0.75], 8.5)

    add_heading(doc, "Objectives", 1)
    add_heading(doc, "General Objective", 2)
    add_para(doc, "To design and document an accessible, searchable, and governed digital repository that supports SPUD academic-output discovery, controlled reading, publisher submission, administrator review, and operational reporting.")
    add_heading(doc, "Specific Objectives", 2)
    add_bullets(doc, [
        "OBJ-01 — Provide public discovery of approved academic outputs with server-owned routing, search, autocomplete, filters, and author profiles.",
        "OBJ-02 — Enforce session and capability boundaries for registered users, publishers, and administrators through backend middleware.",
        "OBJ-03 — Validate PDF uploads and metadata, support compiled works, and retain pending, approved, rejected, archived/deleted, and restored states.",
        "OBJ-04 — Normalize authors, departments, affiliations, classifications, research agendas, topics, and keywords so that retrieval and reporting share stable dimensions.",
        "OBJ-05 — Provide guest preview, authenticated PDF.js reading, saved items, history, reading status, private annotations, access requests, and expiring download tokens.",
        "OBJ-06 — Provide publisher news/media workflows and administrator inquiry triage with durable notification jobs.",
        "OBJ-07 — Provide operational dashboards, Manila-aligned ranges, search analytics, top-activity detail, and CSV/PDF exports with privacy guardrails.",
        "OBJ-08 — Support Experience Studio draft/publish/rollback and abstract extraction review queues.",
        "OBJ-09 — Verify the implementation with type checks, unit tests, database fixtures, browser tests, accessibility checks, and manual UAT scenarios.",
        "OBJ-10 — Keep production Meilisearch integration and unresolved document-level ACL depth explicitly future rather than claiming completion.",
    ])
    add_heading(doc, "Objective-to-Evidence Matrix", 2)
    add_table(doc, ["Objective", "Evidence", "Verification", "Status"], [
        ("OBJ-01", "Public routes, search handlers, public screenshots", "Public Playwright suite and manual browsing", "Implemented"),
        ("OBJ-02", "authMiddleware.ts, Better Auth config, protected routes", "401/403 route tests and admin/user captures", "Implemented"),
        ("OBJ-03", "upload routes, document services, migrations", "Upload suite; negative PDF tests", "Implemented with browser limitations"),
        ("OBJ-04", "classification services and reference tables", "Classification database test; admin UI", "Implemented"),
        ("OBJ-05", "reader routes, annotations, requests, stream checks", "User captures; protected-file and token scenarios", "Implemented"),
        ("OBJ-06", "news, media, inquiries, notification jobs", "Admin/publisher captures and route checks", "Implemented"),
        ("OBJ-07", "operationalReportingService and reporting migrations", "15 unit/contract tests and isolated DB test", "Implemented"),
        ("OBJ-08", "Experience Studio routes and abstract worker", "6 Experience Studio smoke tests; worker code review", "Implemented / gated by worker"),
        ("OBJ-09", "evidence logs and screenshot register", "Commands and results in Appendix G", "Implemented"),
        ("OBJ-10", "feature-status register and architecture boundary", "Source review; no active runtime adapter", "Future"),
    ], [0.7, 2.25, 2.25, 1.3], 8.5)

    add_heading(doc, "Scope and Delimitations", 1)
    add_heading(doc, "Scope", 2)
    add_para(doc, "In scope are SPUD academic outputs including thesis, dissertation, Confluence, and Synergy records; public discovery; registered-reader functions; publisher submissions; administrator governance; PDF preview and streaming; classification; news and media; contact inquiries; analytics; reports; exports; configuration; and deployment workers.")
    add_heading(doc, "Delimitations", 2)
    add_bullets(doc, [
        "PeAS is a digital repository workflow; it does not prescribe physical-record preservation procedures.",
        "No external-library federation is claimed, and no production Meilisearch integration is active.",
        "No predictive analytics or unsupported high-volume/near-instant performance claim is retained.",
        "Optional Microsoft identity, SMTP, malware scanning, and object-storage integrations depend on deployment configuration and credentials.",
        "Broad roles and existing request/permission workflows are implemented; unresolved document-level ACL depth remains a design decision.",
        "Preservation concepts follow OAIS and metadata principles as guidance; no certification or permanent-retention guarantee is implied.",
    ])
    add_table(doc, ["Implemented boundary", "Future or gated boundary"], [
        ("PostgreSQL-backed search, autocomplete, filters, and aggregate analytics", "Meilisearch adapter and index operations"),
        ("Public, registered user, publisher, administrator roles and capabilities", "Fine-grained per-document ACL policy"),
        ("Local/private storage adapter and Docker volumes", "Production object-storage adapter and restore drills"),
        ("Abstract/media workers when enabled", "Optional OCR, malware scan, SMTP, and Entra credentials"),
        ("Reports, CSV/PDF export, Experience Studio draft/publish/rollback", "Additional integrations and predictive analysis"),
    ], [3.2, 3.3], 9)

    add_heading(doc, "Significance of the Study", 1)
    add_para(doc, "Students gain a predictable path to find public academic outputs, preview documents, save items, and track reading. Faculty and researchers gain normalized authorship and classification context that makes related work easier to locate. Office staff gain a review queue, controlled publication workflow, contact triage, and operational reports. Administrators gain backend-enforced governance, role management, access-request decisions, exportable summaries, and Experience Studio controls. The institution gains a coherent repository boundary that reduces duplication and uncontrolled file exposure. These are verified workflow benefits, not marketing promises; preservation and accessibility are described as risk reduction rather than absolute guarantees.")

    add_heading(doc, "Existing Archiving Systems", 1)
    add_para(doc, "DSpace, EPrints, and Digital Commons demonstrate established repository patterns: descriptive metadata, search, submission workflows, access policies, and institutional hosting choices. PeAS is compared against those patterns for fit, not ranked as universally superior. Comparative testing was not conducted, so claims are limited to documented capabilities and institution-specific requirements.")
    add_table(doc, ["Criterion", "DSpace", "EPrints", "Digital Commons", "PeAS fit"], [
        ("Metadata", "Configurable repository metadata", "Configurable eprint metadata", "Hosted scholarly repository metadata", "SPUD-specific authors, departments, agendas, topics, and keywords"),
        ("Search", "Repository search and indexing", "Repository search", "Hosted discovery/search", "PostgreSQL search/autocomplete now; Meilisearch planned"),
        ("Roles", "Repository and collection permissions", "Repository/editor workflows", "Institution-managed workflows", "Public, user, publisher, administrator capabilities"),
        ("Customization", "Extensible open-source platform", "Extensible open-source platform", "Vendor-managed platform", "React shells plus Experience Studio"),
        ("Hosting", "Self-hosted or managed", "Self-hosted or managed", "Hosted service", "Docker Compose and private storage boundary"),
        ("Reporting", "Repository analytics extensions", "Reporting extensions", "Vendor reporting", "Operational rollups, search analytics, CSV/PDF export"),
        ("Institutional fit", "Broad repository model", "Broad repository model", "Broad hosted model", "SPUD workflows and local governance"),
    ], [1.0, 1.25, 1.25, 1.25, 1.75], 8)

    add_heading(doc, "Technologies Used", 1)
    add_para(doc, "The following table records actual technology status rather than preserving the draft’s obsolete MySQL, OrangeApp, or HTML-only descriptions.")
    add_table(doc, ["Technology", "Purpose", "Actual status", "Constraint"], [
        ("React, TypeScript, Vite, CSS", "Public and administrative UI", "Implemented", "Separate HTML shells and UI entry points"),
        ("Deno and Oak", "HTTP server, routes, middleware, workers", "Implemented", "Permission-scoped runtime and explicit environment"),
        ("PostgreSQL 17", "Identity, repository metadata, workflow, reporting", "Implemented", "Migrations and test databases must remain aligned"),
        ("Better Auth", "PeAS-managed sessions and account flows", "Implemented", "Microsoft sign-in is optional and configuration-gated"),
        ("Docker Compose", "App, database, workers, health checks", "Implemented", "Environment and volume discipline required"),
        ("PDF.js, Poppler, WebP", "Reading, validation, guest preview", "Implemented / worker-gated", "File and worker failures need explicit review states"),
        ("FFmpeg/FFprobe", "Media processing and variant validation", "Implemented / worker-gated", "Not every deployment enables media processing"),
        ("PostgreSQL search", "Current search/autocomplete", "Implemented", "Future scale path may add Meilisearch"),
        ("Meilisearch", "Potential dedicated search index", "Planned", "No production runtime integration in baseline"),
        ("Charting/report/export libraries", "Operational dashboard and CSV/PDF output", "Implemented", "Exports require privacy and range validation"),
    ], [1.45, 2.0, 1.35, 1.7], 8.5)

    add_heading(doc, "Theoretical and Conceptual Framework", 1)
    add_heading(doc, "Information Retrieval and Metadata", 2)
    add_para(doc, "PeAS treats metadata as a retrieval contract: titles, authors, classifications, departments, topics, keywords, and document types are indexed and filtered consistently. Dublin Core terminology is a comparison point where it maps to actual fields; the project does not claim a full Dublin Core profile. Search ranking and autocomplete are current PostgreSQL behaviors, while a dedicated search index is an extension point.")
    add_heading(doc, "OAIS and Digital-Preservation Concepts", 2)
    add_para(doc, "OAIS concepts help separate ingest, descriptive information, storage, access, and administration. PeAS implements pieces of that conceptual separation—validated ingest, source hashes, private storage, controlled access, and operational state—but is not certified OAIS-compliant and does not promise permanent preservation. Retention, backup, restore, and institutional policy remain necessary beyond the application.")
    add_heading(doc, "RBAC and Least Privilege", 2)
    add_para(doc, "Backend capability middleware is the authorization authority. UI visibility is treated as convenience only. A route can require a capability such as documents:review, reports:export, or system:admin; ownership and request/token state can add another boundary. This layered check supports least privilege and gives tests a concrete decision point.")
    add_heading(doc, "Layered Conceptual Architecture", 2)
    add_para(doc, "The architecture has five conceptual layers: presentation (browser and shells), application (Deno/Oak routes and services), data (PostgreSQL), storage/media (private files and workers), and optional external services (SMTP, Microsoft identity, future search or object storage). The runtime/container and deployment figures make that boundary explicit.")


def add_architecture_sections(doc):
    add_heading(doc, "Development Process", 1)
    add_para(doc, "The observable process is iterative and evidence-oriented. The repository contains Git history, database migrations, source-level route and service boundaries, Docker deployment definitions, and automated checks. This documentation does not claim JIRA, Trello, Scrum ceremonies, or CI pipelines that are not evidenced in the working tree.")
    for title, body in [
        ("Requirements refinement", "Legacy sections were retained as coverage guidance, then rewritten against current routes, schema, middleware, and tests. Each technical claim receives a status and evidence location."),
        ("Architecture and data modeling", "Domain boundaries were inspected across identity, repository, classification, reader activity, publishing/media, inquiries, reporting, and configuration. Migrations remain the database change record."),
        ("Incremental implementation", "Features are described by behavior—upload, review, publication, discovery, reader activity, reporting, and configuration—rather than by a file dump."),
        ("Migration discipline", "Schema changes are additive and versioned. Reporting tests create isolated *_test databases and validate migrations, fixtures, backfill reconciliation, and reporting behavior."),
        ("Automated verification", "Deno type checks, UI type checks, unit and route tests, database fixtures, browser suites, and Experience Studio smoke tests are recorded with exact commands and limitations."),
        ("Local deployment and review", "Docker Compose health checks were inspected for app, database, media worker, and abstract worker. Screenshots were captured with disposable synthetic accounts."),
        ("Documentation maintenance", "The claim ledger, feature-status register, evidence manifest, screenshot register, and revision checklist are the maintenance interfaces for future editions."),
    ]:
        add_heading(doc, title, 2); add_para(doc, body)

    add_heading(doc, "System Architecture and Implementation", 1)
    add_para(doc, "The following diagrams are generated for this edition at print resolution. Each uses a restrained semantic palette: green identifies PeAS-owned runtime or data domains, cream identifies audiences or deployment boundaries, and gold identifies information flow. The full relationship reference is deliberately grouped in Appendix E so that a single portrait-page ERD does not become unreadable.")
    for path, cap in [
        ("fig01-context.png", "Figure 1. PeAS system context. Source: current route, authentication, worker, and deployment boundaries; generated for this edition."),
        ("fig02-runtime.png", "Figure 2. Runtime/container view. Source: Docker Compose services, Deno entry point, storage boundary, and worker configuration."),
        ("fig03-lifecycle.png", "Figure 3. Document lifecycle and level-1 repository flow. Source: upload, review, publication, delivery, and token workflows."),
        ("fig04-auth-sequence.png", "Figure 4. Authentication and authorization sequence. Source: Better Auth session resolution, capability middleware, ownership, and protected delivery."),
        ("fig05-erd.png", "Figure 5. Simplified domain ERD. Source: current schema and service domains; complete table register appears in Appendix E."),
        ("fig06-deployment.png", "Figure 6. Docker deployment view. Source: current compose services, named volumes, health checks, workers, and optional external connections."),
    ]:
        add_picture_with_caption(doc, DIAGRAMS / path, cap, 6.3)
        add_para(doc, "Interpretation: the figure is a deliberately simplified communication aid; the API and data appendices remain authoritative for exact interfaces.")

    add_heading(doc, "Implementation Details", 1)
    details = [
        ("Public routing and shared shell", "Public entry points use server-owned HTML shells and session-aware rendering. Compatibility aliases remain registered for old clients where necessary. Error experiences are explicit and avoid revealing private storage paths or internal stack traces."),
        ("Authentication and authorization", "Better Auth provisions accounts and sessions. The backend normalizes role values and applies capability middleware. A route can require a broad role, a capability, ownership, or a request/token state; the server—not a hidden UI menu—is authoritative."),
        ("Document lifecycle", "Upload validation checks metadata and PDF boundaries before review. Single and compiled works have distinct metadata paths. Approved records become discoverable; rejected, archived/deleted, and restored states remain represented in workflow data. Source hashes help detect replacement and support evidence."),
        ("Authors and classification", "Author records and reference data are normalized. Research agenda codes, departments, classifications, topics, and keywords are managed through transactional services so invalid combinations do not silently replace persisted state."),
        ("Search and autocomplete", "Current search uses PostgreSQL filtering and ranking across approved metadata. Suggestions and autocomplete avoid publishing identifiers as analytics dimensions. Search analytics are privacy-preserving rollups with filters for prefetches and known crawlers. Meilisearch is planned, not current."),
        ("Preview and protected reading", "Guest preview uses WebP derivatives. Authenticated readers use PDF.js and a protected stream/download path. Access requests produce time-limited tokens; expiry and revocation are checked before delivery. Direct protected-file access is a negative test."),
        ("Saved items, history, status, and annotations", "Registered users can save documents, mark reading status, review history, and store private annotations. Annotation anchors can be re-evaluated when source hashes change. Retention and export are private-user concerns and must not leak through public analytics."),
        ("News and media", "Publishers manage news within ownership and capability limits. Media uploads are processed into validated variants by a worker when configured, with accessibility metadata and unpublished/unready states kept out of public delivery."),
        ("Contact inquiries and notifications", "The contact transaction stores an inquiry, administrator notes, triage state, and a durable notification job. SMTP availability is configuration-gated; the inquiry record is not lost solely because an email attempt fails."),
        ("Reporting and exports", "Reports use explicit Manila-aligned ranges and canonical definitions. Dashboards, top-activity detail, search analytics, CSV, and PDF exports validate ranges, formats, role boundaries, and privacy constraints. Unsupported range values are rejected before database access."),
        ("Experience Studio", "Experience Studio locks a schema for editable content, validates assets, and supports draft, publish, and rollback. It does not grant a user capability beyond administrator configuration boundaries. Public runtime reads published configuration; settings remain recoverable."),
        ("Abstract extraction", "The abstract worker extracts text from PDFs, uses OCR fallback where enabled, records queue state and errors, and exposes a review path rather than silently replacing human-authored metadata. Worker health and dependency availability are deployment concerns."),
        ("Deployment and operations", "Docker Compose groups the web process, PostgreSQL, media worker, and abstract worker. Configuration is passed through environment variables. Private storage, logs, health checks, backups, restore considerations, and SMTP/identity integrations must be operated as deployment controls rather than assumed by the application."),
    ]
    for title, body in details:
        add_heading(doc, title, 2); add_para(doc, body)

    add_heading(doc, "Subsystem Evidence Cards", 2)
    add_para(doc, "Each card records the six questions required for an auditable as-built description: purpose, users, data flow, authorization boundary, failure behavior, privacy implication, and verification evidence. The cards are deliberately repetitive because they are intended to be used as maintenance checklists when a subsystem changes.")
    cards = [
        ("Public application shell", "Provides stable public entry points, responsive layout, error pages, and session-aware navigation.", "Public visitors; all audiences when viewing public content.", "Browser → server-owned shell → public route handler → metadata/read model.", "Public catalog routes; no authenticated capability required for approved metadata.", "Invalid route returns an explicit error experience; backend does not expose stack traces or storage paths.", "Public pages contain only approved metadata and aggregate-safe activity; no session identifiers in analytics.", "Public Playwright project; public screenshots; route source review."),
        ("Authentication and sessions", "Creates and resolves Better Auth sessions and provisions PeAS-managed accounts.", "Public visitor during sign-in; registered users, publishers, administrators.", "Credential or optional provider → Better Auth → session cookie → Deno session resolver.", "Session validation precedes protected route and capability checks.", "Bad credentials return a closed authentication error; expired sessions return 401.", "HttpOnly/session controls and bounded cookies reduce exposure; provider integration is configuration-gated.", "Auth middleware, login capture, 401 route tests."),
        ("Role and capability enforcement", "Translates normalized roles into capabilities and prevents UI-only authorization.", "All audiences; administrators manage roles.", "Request → session → role normalization → capability middleware → handler/service.", "Capabilities such as documents:upload, documents:review, reports:view/export, system:admin.", "Missing or mismatched capability returns 403; ownership checks may further deny.", "Denials are intentionally opaque about protected resources; audit context avoids private data in public responses.", "authMiddleware.ts; reporting route tests; role matrix."),
        ("Document ingest and review", "Accepts single and compiled PDFs, validates metadata, and moves records through review states.", "Publishers submit; administrators review; readers discover approved records.", "Multipart upload → validation → private storage/hash → pending record → admin decision → public read model.", "Upload capability for publisher/admin; review capability for administrator; ownership for publisher edits.", "Invalid/non-PDF data is rejected before publication; worker failures remain pending/failed for review.", "Private originals and hashes are not public; rejected metadata remains staff-governed.", "Upload browser suite; schema/migration review; negative upload cases."),
        ("Reference data and classification", "Normalizes authors, departments, classifications, agendas, topics, and keywords.", "Administrators; readers consume normalized values.", "Admin form → transaction service → reference tables and join tables → search/report dimensions.", "Administrator management and document classification capabilities.", "Invalid combinations roll back transaction; existing persisted classification is preserved.", "Reference data is public only where intentionally rendered; administrative changes are auditable.", "Classification database fixture passed; admin classification capture."),
        ("Search and autocomplete", "Finds approved records with metadata filters and suggestions.", "Public visitors and all authenticated audiences.", "Search term/filters → normalized query → PostgreSQL joins/ranking → bounded result set.", "Approved-public filter is mandatory; protected bytes are never returned by search.", "Malformed range/filter returns closed 400; database failure returns safe server error.", "Analytics records aggregate terms and excludes prefetch/crawler noise; no raw user identity is needed.", "Public search capture; reporting analytics unit tests; current search service."),
        ("Reader delivery and access requests", "Separates guest WebP preview, authenticated PDF.js reading, and time-limited requests.", "Public visitors preview; registered users request/read; administrators decide requests.", "Detail → preview derivative or session/token check → protected stream/download.", "Session, capability, ownership, request state, expiry, and revocation are checked before bytes.", "Expired/revoked tokens and direct paths are denied; unready files fail closed.", "Original PDFs and access history are private; public analytics sees aggregate events only.", "Reader captures; protected-file negative scenarios; token service review."),
        ("Saved items, history, status, annotations", "Supports private reader productivity without changing the public repository.", "Registered users only, with administrator support for operational diagnosis.", "Reader action → authenticated user id → private tables → account page/export.", "Owner check is required for read/update/delete; annotation capability can be disabled.", "Unauthenticated actions return 401; disabled or invalid annotations return 403/422.", "Private bodies and anchors never enter public search or aggregate reports.", "Synthetic user captures; route/service tests; source-hash re-anchoring review."),
        ("News and media", "Publishes institutional news with ownership and validated media variants.", "Publishers manage owned content; administrators govern all content; visitors read published items.", "Editor → news transaction → media upload → worker variants → publication read model.", "news:manage/delete plus ownership for publisher; administrator override.", "Unready or unpublished media is not publicly delivered; worker failures remain visible to staff.", "Accessibility metadata and public delivery avoid leaking private source files.", "Publisher/admin captures; media worker source; unpublished-content negative cases."),
        ("Inquiries and notifications", "Stores contact messages, notes, triage, and durable notification jobs.", "Public visitors submit; administrators triage.", "Contact form → inquiry transaction → notification job → optional SMTP worker.", "Public create is constrained; administrator notes and state transitions require admin capability.", "SMTP failure does not delete inquiry; job records retry/failure for operations.", "Sender data is staff-private and excluded from public analytics.", "Contact capture; notification worker source; inquiry schema review."),
        ("Operational reporting", "Provides canonical ranges, rollups, dashboards, top-activity detail, and exports.", "Administrators; no publisher/user reporting access.", "Events → privacy filter → rollup tables → report query → dashboard/CSV/PDF.", "reports:view/export and validated range/format inputs.", "Unsupported range/format rejected before DB; incomplete rollups remain labelled.", "Aggregate-only definitions and Manila boundaries reduce individual tracking.", "15 unit/contract/export tests; isolated reporting database suite."),
        ("Experience Studio", "Manages editable content and assets with draft/publish/rollback.", "Administrators; public runtime consumes published configuration.", "Admin draft → schema/asset validation → version → publish → public read.", "system:admin; public cannot mutate configuration.", "Invalid schema or asset rejected; rollback restores prior published version.", "Configuration content is separated from user/private data; asset paths remain controlled.", "Six desktop/mobile smoke tests; admin screenshot; Studio route source."),
        ("Abstract extraction worker", "Extracts text/abstract candidates and routes uncertain output for review.", "Worker/internal process; administrators review; readers consume approved metadata.", "Queue row → PDF/Poppler/OCR → candidate text → review decision → document metadata.", "Worker credential/internal route; review capability for final acceptance.", "Missing dependency or malformed PDF marks job failed with retry/diagnostic state.", "Extracted text stays within private metadata until approved; logs redact file paths where possible.", "Worker source, queue schema, Docker health, abstract review capture."),
        ("Deployment and storage", "Runs web, database, media worker, abstract worker, volumes, health checks, and optional integrations.", "Operations/administrators; all audiences indirectly.", "Browser → app → DB/storage/workers → SMTP/identity when configured.", "Environment variables, Docker network, private volumes, health checks.", "Unhealthy dependency is surfaced; file delivery and worker jobs fail closed rather than exposing paths.", "Backups must pair database and storage; logs and retention are operational controls.", "docker compose ps; ReadMe.md; deployment diagram; baseline manifest."),
    ]
    for title, purpose, users, flow, auth, failure, privacy, evidence in cards:
        add_heading(doc, title, 3)
        add_table(doc, ["Question", "Evidence-backed answer"], [
            ("Purpose", purpose), ("Users", users), ("Data flow", flow), ("Authorization boundary", auth), ("Failure behavior", failure), ("Privacy implication", privacy), ("Verification evidence", evidence)
        ], [1.65, 4.85], 8.5)

    add_heading(doc, "Legacy Claim Reconciliation", 2)
    add_table(doc, ["Legacy draft claim", "Current documentation treatment", "Reason/evidence"], [
        ("MySQL database", "Replaced with PostgreSQL 17", "Current schema, Docker deployment, and database tests"),
        ("OrangeApp authentication", "Replaced with PeAS-managed Better Auth sessions; optional Microsoft sign-in only when configured", "Current auth config and middleware"),
        ("Meilisearch is implemented", "Relabelled planned; current search is PostgreSQL-backed", "No active runtime adapter in baseline"),
        ("Three roles", "Expanded to public visitor, registered user, content publisher, administrator", "Role normalization and capability matrix"),
        ("HTML-only presentation", "Replaced with shared React application, server-owned shells, admin React surfaces, and Experience Studio", "Current UI entry points and captures"),
        ("Permanent preservation/legal compliance", "Removed as unsupported guarantee; described as risk reduction and future policy work", "No certification or institutional policy evidence"),
    ], [2.1, 2.65, 1.75], 8.2)


def add_testing(doc, control):
    add_heading(doc, "Testing and Evaluation", 1)
    add_para(doc, "Verification was recorded against commit " + control["commit"] + " on the current working tree. The test-data profile uses the existing local database only for read-only observation and disposable synthetic accounts for screenshots; isolated reporting and classification databases are used for database-backed fixtures.")
    add_table(doc, ["Evidence category", "Command or method", "Result", "Limitation"], [
        ("Deno type check", "npm run check:deno", "Passed", "Environment-specific credentials are not inferred"),
        ("UI type check", "npm run check:ui", "Passed", "Type correctness is not a substitute for browser behavior"),
        ("Deno unit suite", "npm run test:deno", "101 passed; 0 failed", "Some DB checks require explicit network/test DB permissions"),
        ("Classification DB", "PGDATABASE=peas_classification_20260802_test deno task --cwd Deno classification:db-test", "Passed", "Runs against an isolated existing *_test database"),
        ("Reporting DB", "npm run test:reporting:db", "Passed", "Runner creates and removes an isolated container"),
        ("Reporting routes", "npm run test:reporting:routes", "10 passed; 0 failed", "Route preconditions are unit-level"),
        ("Reporting unit/contract/export", "npm run test:reporting:unit", "15 passed; 0 failed", "DB connection warning is expected without net permission in unit runner"),
        ("Public browser", "PEAS_BASE_URL=http://localhost:18080 npm run test:public", "Chromium-supported flows largely passed; documented failures remain", "WebKit binary unavailable; contrast and login styling assertions fail"),
        ("Administrator browser", "PEAS_BASE_URL=http://localhost:18080 npm run test:admin", "63 passed; 7 failed", "Publisher workspace, upload flow, tooltip strictness, and missing WebKit are recorded"),
        ("Experience Studio", "PEAS_BASE_URL=http://localhost:18080 npm run test:experience", "6 passed; 0 failed", "Desktop and mobile smoke coverage"),
        ("Accessibility", "Browser axe checks plus keyboard/manual review", "Representative screens reviewed; contrast issues remain in existing UI", "No claim of full WCAG conformance"),
    ], [1.2, 2.2, 1.7, 1.4], 8)
    add_heading(doc, "Manual and UAT Scenarios", 2)
    add_bullets(doc, [
        "UAT-01 public browsing: open home, news, search autocomplete, filters, author profile, document detail, guest preview, contact, login, and error experience.",
        "UAT-02 registered reader: sign in, open PDF.js reader, save, mark as read, inspect history, create a private annotation, and review account pages.",
        "UAT-03 publisher: inspect constrained navigation, edit news, upload media, and submit a pending document for review.",
        "UAT-04 administrator: review documents, inspect compiled preview, manage classifications and authors, inspect reports/exports, triage inquiries, manage roles, and publish Experience Studio configuration.",
    ])
    add_heading(doc, "Negative Tests and Known Limitations", 2)
    add_bullets(doc, [
        "Unauthenticated protected endpoints return 401; unauthorized publisher/user actions return 403 where route tests cover them.",
        "Direct protected-file access, invalid/non-PDF uploads, expired or revoked tokens, disabled annotations, unready media, unpublished content, invalid report ranges, and invalid export formats are treated as negative scenarios.",
        "The local Playwright installation has no WebKit executable, so WebKit evidence is unavailable until the engine is installed.",
        "Existing browser assertions still report contrast violations, a login-button color mismatch, publisher workspace copy, strict tooltip matching, and guided-upload expectation failures. These are disclosed as current UI/test limitations, not silently rewritten in the documentation build.",
        "No performance number is reported because no controlled performance run was completed for this edition.",
    ])

    # screenshots body
    add_heading(doc, "Screenshots of PeAS in Action", 1)
    add_para(doc, "Screenshots were captured from the current application at 1440×900 desktop and 390×844 mobile sizes using synthetic documentation accounts. No real names, emails, tokens, storage paths, or production records are included. The main body shows representative screens; the full register is Appendix H.")
    shot_map = [
        ("public-home-desktop.png", "Figure 7. Public home page (public visitor; desktop). Purpose: entry point and discovery shell."),
        ("public-login-desktop.png", "Figure 8. Login page (public visitor; desktop). Purpose: Better Auth entry point."),
        ("public-home-mobile.png", "Figure 9. Public home page (public visitor; mobile 390×844). Purpose: responsive layout check."),
        ("doc-user-2026-home.png", "Figure 10. Registered-user home (synthetic account; desktop). Purpose: session-aware reader entry."),
        ("doc-user-2026-search.png", "Figure 11. Registered-user search view (synthetic account; desktop). Purpose: search/filter discovery."),
        ("doc-user-2026-annotations.png", "Figure 12. Private annotations view (synthetic account; desktop). Purpose: user-owned activity boundary."),
        ("admin-dashboard.png", "Figure 13. Administrator dashboard (admin role; desktop). Purpose: operational overview."),
        ("admin-reports.png", "Figure 14. Administrator reports (admin role; desktop). Purpose: Manila-aligned reporting and exports."),
        ("admin-classification.png", "Figure 15. Classification management (admin role; desktop). Purpose: controlled reference data."),
        ("doc-publisher-2026-news-admin.png", "Figure 16. Publisher news workspace (synthetic account; desktop). Purpose: publisher-scoped content workflow."),
        ("admin-experience.png", "Figure 17. Experience Studio (admin role; desktop). Purpose: draft/publish configuration boundary."),
    ]
    for name, cap in shot_map:
        add_picture_with_caption(doc, SCREEN / name, cap, 6.25)
        add_para(doc, "Capture note: current local Docker deployment; synthetic data; capture date " + control["generated"].split("T")[0] + ".")

    add_heading(doc, "References", 1)
    refs = [
        "Better Auth. (2026). Session management. https://better-auth.com/docs/concepts/session-management",
        "Deno Land. (2026). Permissions. https://docs.deno.com/runtime/reference/permissions/",
        "Docker. (2026). Compose file reference: Services. https://docs.docker.com/reference/compose-file/services/",
        "Dublin Core Metadata Initiative. (2020). DCMI metadata terms. https://www.dublincore.org/specifications/dublin-core/dcmi-terms/",
        "International Organization for Standardization. (2012). ISO 14721:2012—Space data and information transfer systems—Open archival information system (OAIS)—Reference model.",
        "Meilisearch. (2026). Typo tolerance settings. https://www.meilisearch.com/docs/capabilities/full_text_search/relevancy/typo_tolerance_settings",
        "Mozilla. (2026). PDF.js getting started. https://mozilla.github.io/pdf.js/getting_started/?lang=en",
        "OWASP Foundation. (2025). Application Security Verification Standard. https://owasp.org/www-project-application-security-verification-standard/",
        "PostgreSQL Global Development Group. (2025). PostgreSQL 17 documentation. https://www.postgresql.org/files/documentation/pdf/17/postgresql-17-US.pdf",
        "W3C Web Accessibility Initiative. (2023). Web Content Accessibility Guidelines (WCAG) 2.2. https://www.w3.org/TR/WCAG22/",
        "St. Paul University Dumaguete. (2026). PeAS Capstone project notes and implementation records. Internal project documentation in docs/PeAS Capstone/.",
    ]
    for ref in refs:
        p = doc.add_paragraph(); p.paragraph_format.left_indent = Inches(0.3); p.paragraph_format.first_line_indent = Inches(-0.3); p.add_run(ref)


def add_appendices(doc, control):
    doc.add_page_break()
    add_heading(doc, "Appendix A: Requirements and Objectives Traceability", 1)
    add_table(doc, ["ID", "Requirement/objective", "Feature response", "Evidence"], [
        ("REQ-01", "Public users can discover approved academic outputs", "Public routes, search, filters, author profiles", "Public screenshots; route tests"),
        ("REQ-02", "Reader activity remains private to its owner", "Saved items, history, status, annotations", "Authenticated routes; user captures"),
        ("REQ-03", "Publishers submit and manage within scope", "News ownership; pending document workflow", "Publisher capture; admin route tests"),
        ("REQ-04", "Administrators govern repository state", "Review, classification, roles, reports, Studio", "Admin captures; capabilities"),
        ("REQ-05", "Files are not exposed by storage path", "Protected stream/download and tokens", "Negative direct-file scenarios"),
        ("REQ-06", "Reporting uses stable definitions", "Canonical ranges, rollups, export validation", "Reporting unit/DB evidence"),
        ("SEC-01", "Authentication precedes protected actions", "Better Auth session resolution", "401 route checks"),
        ("SEC-02", "Capability and ownership checks are backend-enforced", "Middleware and service guards", "403 tests; source review"),
        ("UAT-01", "Public browsing journey", "Home → search → detail → preview", "Appendix G script"),
        ("UAT-02", "Registered reader journey", "Login → read → save → annotate", "Appendix G script"),
        ("UAT-03", "Publisher journey", "News → media → pending submission", "Appendix G script"),
        ("UAT-04", "Administrator journey", "Review → classify → report → configure", "Appendix G script"),
    ], [0.75, 2.1, 2.1, 1.55], 8.5)

    add_heading(doc, "Claim Ledger", 2)
    add_para(doc, "The ledger is the control list used to decide whether a statement is current, gated, future, compatibility-only, or legacy. Evidence paths are intentionally short; the source tree and logs remain the detailed record.")
    add_table(doc, ["Claim", "Subsystem", "Evidence location", "Verification", "Status", "Target section"], [
        ("PeAS uses PostgreSQL 17", "Data", "Deno/db/peas_db.sql; Docker", "Reporting/classification DB fixtures", "Implemented", "Technologies"),
        ("Sessions are PeAS-managed Better Auth sessions", "Authentication", "Deno/config/auth.ts; middleware", "Login and 401 tests", "Implemented", "Implementation Details"),
        ("Microsoft sign-in is optional", "Authentication", "Auth configuration", "Credential-gated branch", "Configuration-gated", "Technologies"),
        ("Four audience boundaries exist", "Authorization", "authMiddleware.ts", "Role and 403 tests", "Implemented", "RBAC framework"),
        ("PostgreSQL search/autocomplete is current", "Search", "Search services/routes", "Public browser and analytics tests", "Implemented", "Implementation Details"),
        ("Meilisearch is not current runtime", "Search", "No active adapter in baseline", "Source inventory", "Planned", "Scope/Future"),
        ("Guest preview is separate from PDF stream", "Delivery", "Preview/stream handlers", "Reader and direct-file negatives", "Implemented", "Architecture"),
        ("Access tokens expire and can be revoked", "Access requests", "Request/token service", "Token negative scenarios", "Implemented", "Implementation Details"),
        ("Annotations are private", "Reader activity", "Annotation routes/schema", "Synthetic user capture", "Implemented", "Implementation Details"),
        ("Reporting ranges align to Manila", "Reporting", "operationalReportingService.ts", "Contract tests", "Implemented", "Testing"),
        ("CSV/PDF exports validate inputs", "Reporting", "Export service/routes", "Export and route tests", "Implemented", "Testing"),
        ("Experience Studio supports draft/publish/rollback", "Configuration", "Experience Studio routes", "Six smoke tests", "Implemented", "Implementation Details"),
        ("Abstract extraction depends on a worker", "Worker", "abstract worker and schema", "Docker health/source review", "Configuration-gated", "Deployment"),
        ("Document-level ACL depth is unresolved", "Authorization", "Role/request model", "Design review", "Planned", "Delimitations"),
        ("MySQL/OrangeApp/HTML-only statements describe the old draft", "Legacy", "Source PDF only", "Claim reconciliation", "Legacy draft only", "Background/Appendix I"),
    ], [1.55, 0.9, 1.45, 1.1, 0.85, 0.65], 7.2)

    add_heading(doc, "Appendix B: Role, Capability, Ownership, and Access-Control Matrix", 1)
    add_table(doc, ["Feature/action", "Public", "Registered user", "Publisher", "Administrator", "Backend rule"], [
        ("Browse approved catalog", "Yes", "Yes", "Yes", "Yes", "Published/public filter"),
        ("Guest preview", "Yes", "Yes", "Yes", "Yes", "Preview derivative only"),
        ("PDF stream/download", "No", "Conditional", "Conditional", "Yes", "Session + request/token/ownership"),
        ("Save/history/status", "No", "Own records", "Own records", "Own records", "Authenticated user id"),
        ("Private annotation", "No", "Own records", "Own records", "Own records", "Capability and owner"),
        ("Submit document", "No", "No", "Yes", "Yes", "documents:upload"),
        ("Review/publish", "No", "No", "No", "Yes", "documents:review"),
        ("Manage news", "No", "No", "Owned scope", "Yes", "news:manage + ownership"),
        ("Reports", "No", "No", "No", "Yes", "reports:view"),
        ("Report export", "No", "No", "No", "Yes", "reports:export"),
        ("Roles and capabilities", "No", "No", "No", "Yes", "roles:manage/system:admin"),
        ("Experience Studio", "No", "No", "No", "Yes", "system:admin"),
    ], [1.45, 0.65, 0.9, 0.9, 0.9, 1.7], 8)

    add_heading(doc, "Appendix C: Operation Guides", 1)
    guides = {
        "Public visitor": ["Open the public home page.", "Use search or autocomplete; apply classification, department, author, or document-type filters.", "Open a document detail page and confirm metadata before selecting guest preview.", "If the item requires access, submit the request form; do not copy a protected storage URL.", "Use the contact form for an inquiry and record the confirmation state."],
        "Registered user": ["Sign in through the PeAS login page.", "Open a document and use the PDF.js reader when access is granted.", "Save the item, mark reading status, and confirm it appears in the account pages.", "Create a private annotation; verify it is visible only in the same account.", "Review history and remove saved items when no longer needed."],
        "Content publisher": ["Sign in and confirm the constrained publisher workspace.", "Create or edit owned news content and add accessible media metadata.", "Upload a document through the guided flow; supply valid PDF and metadata.", "Submit the document for review and confirm pending status.", "Do not attempt administrator review or role-management routes."],
        "Administrator": ["Sign in and open the dashboard.", "Review pending documents and inspect metadata/classification before publication.", "Use reports and top-activity detail with a supported Manila-aligned range.", "Export CSV/PDF only after verifying range, audience, and privacy context.", "Triage inquiries, manage roles, configure Experience Studio, and inspect logs/health as appropriate."],
    }
    for role, steps in guides.items():
        add_heading(doc, role, 2); add_bullets(doc, steps, numbered=True)
    add_heading(doc, "Minute-level operating checklist", 2)
    add_para(doc, "The following checkpoints make the role guides reproducible during a walkthrough. A reviewer can mark each checkpoint pass, fail, or not applicable without relying on a screenshot alone.")
    add_table(doc, ["Minute", "Checkpoint", "Expected evidence", "Failure response"], [
        ("00–02", "Confirm route, viewport, and role banner", "Correct shell and role-scoped navigation", "Stop and resolve session/role mismatch"),
        ("02–05", "Load public catalog or role workspace", "No console-blocking error; expected headings", "Capture error state and record route"),
        ("05–08", "Perform primary action", "Search, edit, upload, review, or report action begins", "Check validation and capability response"),
        ("08–12", "Submit or save the action", "200/201 response or explicit validation message", "Do not repeat blindly; inspect request/log"),
        ("12–15", "Verify resulting state", "Published/pending/saved/private state appears", "Check database-backed state or retry policy"),
        ("15–18", "Exercise the nearest negative path", "401/403/400/expired/unready response", "Record actual status and user-facing copy"),
        ("18–20", "Capture screenshot and evidence note", "Synthetic data, viewport, route, capture date", "Remove tokens/PII before inclusion"),
    ], [0.7, 2.1, 2.1, 1.6], 8.2)

    add_heading(doc, "Appendix D: API Reference", 1)
    add_para(doc, "The table is a behavior-oriented inventory. Exact request and response schemas remain in the route source and should be checked before client integration.")
    api_rows = [
        ("GET", "/api/documents", "Public", "catalog read", "List/filter approved documents", "query filters", "200 list", "400 invalid filter", "cache-safe metadata", "document routes"),
        ("GET", "/api/documents/:id/preview", "Public", "preview", "Guest WebP preview", "id", "200 image", "404/403", "no private path", "preview handler"),
        ("GET", "/api/search/suggestions", "Public", "catalog read", "Autocomplete", "term", "200 suggestions", "400", "aggregate-safe", "search service"),
        ("POST", "/api/auth/sign-in", "Public", "account", "Create Better Auth session", "credentials", "session", "401", "HttpOnly cookie", "Better Auth"),
        ("GET", "/api/reader/history", "Registered user", "reader:history", "Own history", "pagination", "200 list", "401", "private/no cache", "reader routes"),
        ("POST", "/api/reader/annotations", "Registered user", "reader:annotate", "Create private annotation", "anchor/body", "201", "401/403/422", "private", "annotation service"),
        ("POST", "/api/access-requests", "Registered user", "request access", "Request protected document", "document id", "201", "401/409", "private", "request service"),
        ("POST", "/api/content/upload", "Publisher/Admin", "documents:upload", "Upload PDF metadata", "multipart", "201 pending", "401/403/422", "private until review", "upload route"),
        ("POST", "/api/content/:id/review", "Administrator", "documents:review", "Approve/reject", "decision", "200", "401/403/409", "audit state", "review route"),
        ("POST", "/api/news", "Publisher/Admin", "news:manage", "Create owned news", "JSON/media", "201", "401/403/422", "unpublished by default", "news route"),
        ("GET", "/api/admin/reports", "Administrator", "reports:view", "Operational report", "range", "200", "401/403/400", "aggregate", "reporting route"),
        ("GET", "/api/admin/reports/export", "Administrator", "reports:export", "CSV/PDF export", "range/format", "file", "401/403/400", "download response", "export route"),
        ("GET", "/api/admin/top-activity", "Administrator", "reports:view", "Top activity detail", "kind/range", "200", "401/403/400", "aggregate", "top activity"),
        ("GET", "/api/admin/experience", "Administrator", "system:admin", "Read Studio config", "none", "200", "401/403", "private admin", "Experience Studio"),
        ("POST", "/api/admin/experience/publish", "Administrator", "system:admin", "Publish config", "draft", "200", "401/403/422", "public after publish", "Experience Studio"),
        ("POST", "/api/internal/abstract-jobs", "Worker/Internal", "worker token", "Process extraction queue", "job", "200", "401/409", "private", "abstract worker"),
    ]
    add_table(doc, ["Method", "Path", "Audience", "Capability", "Purpose", "Inputs", "Success", "Errors", "Privacy/cache", "Evidence"], api_rows, [0.45, 1.2, 0.75, 0.85, 1.15, 0.65, 0.55, 0.7, 0.9, 0.75], 6.8)

    add_heading(doc, "Appendix E: Database Domain Model and Data Dictionary", 1)
    add_para(doc, "The base schema plus applied migrations are the database authority. The grouped reference below is intentionally concise; migrations and schema files remain the source for exact constraints and indexes.")
    db_rows = [
        ("Identity", "users", "id, email, role, status, created_at", "Accounts and normalized role", "Account retention policy"),
        ("Identity", "accounts", "provider/account identifiers", "Better Auth provider linkage", "Credential/provider lifecycle"),
        ("Identity", "sessions", "session token, user id, expiry", "Session resolution", "Expire/revoke per auth policy"),
        ("Repository", "documents", "id, title, file_path, type, review_status, deleted_at", "Primary academic output", "Soft deletion and retention"),
        ("Repository", "compiled_documents", "id, title, status", "Compiled publication", "Workflow retention"),
        ("Repository", "document_authors", "document_id, author_id, order", "Authorship relation", "Retain with document"),
        ("Repository", "authors", "id, display_name, normalized_name", "Author identity", "Reference data"),
        ("Classification", "departments", "id, name, status", "Department vocabulary", "Reference data"),
        ("Classification", "classifications", "id, name, status", "Repository category", "Reference data"),
        ("Classification", "research_agenda", "code, name, active dates", "Official agenda", "Version/effective dates"),
        ("Classification", "topics", "name, normalized_name, status", "Topic vocabulary", "Reference data"),
        ("Classification", "keywords", "term, normalized_term", "Keyword vocabulary", "Reference data"),
        ("Reader", "saved_documents", "user_id, document_id", "Saved item", "Owner-private"),
        ("Reader", "user_document_history", "user_id, document_id, viewed_at", "Reading history", "Owner-private/retention"),
        ("Reader", "reading_status", "user_id, document_id, state", "Mark as read/status", "Owner-private"),
        ("Reader", "annotations", "user_id, document_id, anchor, body", "Private annotation", "Owner-private; source hash"),
        ("Access", "document_requests", "user_id, document_id, status, token expiry", "Access request/token workflow", "Expiry and revocation"),
        ("Publishing", "news", "author, status, publication date", "News content", "Draft/published lifecycle"),
        ("Publishing", "media_assets", "asset id, source, status", "Uploaded media", "Variant/retention"),
        ("Publishing", "media_variants", "asset id, format, path", "Processed delivery variant", "Private until ready"),
        ("Worker", "abstract_jobs", "document, state, attempts, error", "Extraction queue", "Operational queue retention"),
        ("Inquiry", "contact_inquiries", "sender, subject, state, notes", "Contact triage", "Institutional retention"),
        ("Reporting", "repository_activity_rollups", "bucket, document, counts", "Repository aggregates", "Aggregate retention"),
        ("Reporting", "page_activity_rollups", "bucket, page_key, counts", "Page activity aggregates", "Privacy-aware"),
        ("Reporting", "search_activity_rollups", "bucket, normalized term, counts", "Search analytics", "No raw identifiers"),
        ("Config", "experience_settings", "schema, draft, published version", "Experience Studio", "Version history"),
        ("Config", "operational_analytics_state", "feature states and timestamps", "Reporting gates", "Operational state"),
    ]
    add_table(doc, ["Domain", "Table", "Representative columns", "Purpose", "Retention note"], db_rows, [0.85, 1.45, 1.65, 1.55, 1.0], 7.5)

    add_heading(doc, "Full data dictionary reference", 2)
    add_para(doc, "This landscape register expands representative fields into the documentation interface requested for maintenance: table, column, type, nullability, default, key/relationship, index or constraint, domain purpose, and retention note. It is a reference snapshot; migrations remain authoritative for exact SQL.")
    full_fields = [
        ("users", "id", "text", "NO", "generated", "PK", "users_pkey", "Account identifier", "Account lifecycle"),
        ("users", "email", "text", "NO", "none", "unique", "users_email_key", "Login/contact address", "Account policy"),
        ("users", "role", "text", "NO", "user", "domain", "role check", "Normalized audience role", "Authorization history"),
        ("sessions", "token", "text", "NO", "generated", "PK", "sessions_pkey", "Session credential", "Expire/revoke"),
        ("sessions", "expires_at", "timestamptz", "NO", "none", "none", "expiry index", "Session validity", "Automatic expiry"),
        ("documents", "id", "bigint", "NO", "identity", "PK", "documents_pkey", "Academic output key", "Soft-delete lifecycle"),
        ("documents", "title", "text", "NO", "none", "none", "search expression", "Display/search title", "Retain with document"),
        ("documents", "file_path", "text", "NO", "none", "none", "private path policy", "Private original location", "Storage retention"),
        ("documents", "document_type", "text", "NO", "none", "domain", "type check", "Thesis/dissertation/etc.", "Reference history"),
        ("documents", "review_status", "text", "NO", "pending", "domain", "status check", "Workflow state", "Audit/retention"),
        ("documents", "deleted_at", "timestamptz", "YES", "null", "none", "active filter index", "Soft deletion", "Retention schedule"),
        ("authors", "id", "bigint", "NO", "identity", "PK", "authors_pkey", "Author key", "Reference data"),
        ("authors", "normalized_name", "text", "NO", "none", "unique", "authors_name_uidx", "Stable author lookup", "Reference data"),
        ("document_authors", "document_id", "bigint", "NO", "none", "FK", "document_authors_document_idx", "Document relation", "Retain with document"),
        ("document_authors", "author_id", "bigint", "NO", "none", "FK", "document_authors_author_idx", "Author relation", "Retain with author"),
        ("topics", "normalized_name", "text", "NO", "none", "unique", "topics_normalized_name_uidx", "Topic lookup", "Reference data"),
        ("keywords", "normalized_term", "text", "NO", "none", "unique", "keywords_normalized_term_uidx", "Keyword lookup", "Reference data"),
        ("document_requests", "user_id", "text", "NO", "none", "FK", "requests_user_idx", "Requester", "Owner/private"),
        ("document_requests", "status", "text", "NO", "pending", "domain", "request_status_check", "Access workflow", "Expiry/revocation"),
        ("document_requests", "expires_at", "timestamptz", "YES", "null", "none", "expiry index", "Time-limited access", "Automatic expiry"),
        ("annotations", "user_id", "text", "NO", "none", "FK", "annotations_owner_idx", "Private owner", "Owner-private"),
        ("annotations", "source_hash", "text", "YES", "null", "none", "none", "Re-anchoring context", "Owner-private"),
        ("news", "status", "text", "NO", "draft", "domain", "news_status_idx", "Publication state", "Draft/published policy"),
        ("media_assets", "processing_status", "text", "NO", "pending", "domain", "media_status_idx", "Worker state", "Queue retention"),
        ("media_variants", "format", "text", "NO", "none", "compound", "asset_format_uidx", "Delivery variant", "Private until ready"),
        ("abstract_jobs", "state", "text", "NO", "queued", "domain", "abstract_state_idx", "Extraction state", "Operational queue"),
        ("contact_inquiries", "status", "text", "NO", "new", "domain", "inquiry_status_idx", "Triage state", "Institutional policy"),
        ("repository_activity_rollups", "bucket_start", "timestamptz", "NO", "none", "compound", "rollup_bucket_idx", "Aggregation window", "Aggregate retention"),
        ("search_activity_rollups", "normalized_term", "text", "NO", "none", "compound", "search_term_idx", "Privacy-safe term", "Aggregate retention"),
        ("experience_settings", "published_version", "integer", "YES", "null", "none", "version constraint", "Published configuration", "Version history"),
    ]
    add_table(doc, ["Table", "Column", "Type", "Null?", "Default", "Key/relationship", "Index/constraint", "Domain purpose", "Retention note"], full_fields, [1.0, 1.05, 0.7, 0.55, 0.75, 1.0, 1.15, 1.55, 1.15], 6.5)
    add_heading(doc, "Applied migration inventory", 2)
    add_table(doc, ["Migration", "Domain", "Purpose", "Status/evidence"], [
        ("2026-07_better_auth.sql", "Identity", "Better Auth tables and session boundary", "Applied; auth source"),
        ("2026-07_better_auth_audit.sql", "Identity", "Audit additions for account/session operations", "Applied; migration"),
        ("2026-07_contact_inquiries.sql", "Inquiry", "Contact inquiry and triage storage", "Applied; inquiry routes"),
        ("2026-07_legacy_public_path_soak.sql", "Compatibility", "Legacy public path compatibility state", "Applied; compatibility register"),
        ("2026-07_news_posts.sql", "Publishing", "News content lifecycle", "Applied; news routes"),
        ("2026-07_publisher_role.sql", "Authorization", "Publisher role and capability", "Applied; role middleware"),
        ("2026-08_abstract_extraction.sql", "Worker", "Abstract queue and review state", "Worker-gated; abstract tests"),
        ("2026-08_account_records.sql", "Identity", "Account record refinements", "Applied; auth schema"),
        ("2026-08_author_name_integrity.sql", "Repository", "Author normalization constraints", "Applied; classification fixture"),
        ("2026-08_author_profile_notifications.sql", "Repository", "Author profile notification support", "Applied; route/source review"),
        ("2026-08_author_reference_data.sql", "Reference", "Author reference records", "Applied; admin screens"),
        ("2026-08_document_annotations.sql", "Reader", "Private annotation storage", "Applied; reader routes"),
        ("2026-08_document_annotations_hardening.sql", "Reader", "Annotation ownership and hardening", "Applied; negative cases"),
        ("2026-08_document_classification.sql", "Classification", "Agendas/topics/keywords and joins", "Applied; DB fixture passed"),
        ("2026-08_document_read_status.sql", "Reader", "Reading status and history", "Applied; user captures"),
        ("2026-08_news_media.sql", "Publishing", "Media assets and variants", "Worker-gated; media source"),
        ("2026-08_news_saved_items.sql", "Reader", "Saved news/document items", "Applied; reader source"),
        ("2026-08_reporting_v2.sql", "Reporting", "Canonical rollups and report state", "Applied in reporting test"),
        ("2026-08_reporting_v3.sql", "Reporting", "Traffic v3 and backfill support", "Applied; reconciliation passed"),
        ("2026-08_repository_activity.sql", "Reporting", "Repository activity dimensions", "Applied; reporting fixture"),
        ("2026-08_search_analytics.sql", "Reporting", "Privacy-preserving search rollups", "Applied; route/unit tests"),
        ("document_access_tokens.sql", "Access", "Time-limited delivery tokens", "Applied; token service"),
        ("document_categories_table.sql", "Classification", "Category/reference relation", "Applied; schema"),
        ("document_views_table.sql", "Reporting", "Document activity source", "Applied; aggregate path"),
        ("experience_studio_tables.sql", "Configuration", "Draft/publish/rollback settings", "Applied; Studio smoke"),
        ("page_visits_table.sql", "Reporting", "Legacy/page activity compatibility", "Applied; deprecated writer"),
        ("user_document_history.sql", "Reader", "Reader history", "Applied; user route"),
        ("visit_counters_tables.sql", "Reporting", "Legacy counters/compatibility", "Applied; compatibility only"),
    ], [1.7, 1.0, 2.4, 1.4], 7.8)

    add_heading(doc, "Appendix F: Deployment, Environment, Health, Backup, and Recovery", 1)
    add_bullets(doc, [
        "Start the documented Docker Compose stack and confirm the app, db, media-worker, and abstract-worker health states before UAT.",
        "Keep secrets, database passwords, Better Auth secret, SMTP credentials, optional identity credentials, and storage configuration outside committed source.",
        "Verify PostgreSQL migrations before enabling new reporting or classification behavior; run isolated *_test fixtures first.",
        "Back up database and private storage together so metadata and file hashes remain reconstructible as a pair.",
        "Test restore into a non-production environment; record schema version, file count, hashes, and worker queue state.",
        "Monitor worker queues, failed extraction/media jobs, SMTP failures, database health, disk space, and application logs.",
        "Treat object storage, malware scanning, Microsoft identity, and SMTP as configuration-gated integrations, not assumptions.",
    ])
    add_table(doc, ["Variable/boundary", "Purpose", "Required?", "Failure behavior"], [
        ("PGUSER/PGPASSWORD/PGDATABASE/PGHOST/PGPORT", "PostgreSQL connection", "Yes", "Startup diagnostics report DB failure; routes fail safely"),
        ("BETTER_AUTH_SECRET / BETTER_AUTH_URL", "Session signing and URLs", "Yes", "Authentication cannot be trusted without it"),
        ("MICROSOFT_CLIENT_ID/SECRET/TENANT_ID", "Optional Entra sign-in", "No", "Microsoft sign-in disabled"),
        ("SMTP_*", "Durable notification delivery", "Deployment-dependent", "Inquiry persists; delivery job records failure"),
        ("Storage adapter/path", "Private PDFs and media", "Yes", "Preview/stream/worker operations fail closed"),
        ("Worker flags", "Abstract/media processing", "Deployment-dependent", "Queue remains pending or failed for review"),
    ], [2.0, 2.1, 1.0, 1.4], 8.5)
    add_heading(doc, "File-storage and retention register", 2)
    add_table(doc, ["Data/file", "Storage boundary", "Owner/audience", "Retention/control", "Failure behavior"], [
        ("PDF original", "Private storage volume or object adapter", "Repository/admin/authorized reader", "Hash, backup, soft-delete policy", "Protected delivery fails closed"),
        ("Guest WebP preview", "Derived private/public-delivery boundary", "Public after publication", "Regenerate from original; no source path", "Preview unavailable; original remains protected"),
        ("PDF.js reader bytes", "Authenticated stream response", "Registered user/admin/token holder", "No public cache; token expiry", "401/403/expired response"),
        ("Media source", "Private media volume", "Publisher/admin/worker", "Retain until variants verified", "Unready media stays unpublished"),
        ("Media variants", "Validated delivery path", "Public after publication", "Variant status and format checks", "Worker failure remains queued/failed"),
        ("Abstract candidate", "PostgreSQL metadata/queue", "Admin review", "Review/replace with provenance", "Job marked failed; no silent overwrite"),
        ("Access token", "Database/session boundary", "Requester and delivery service", "Short expiry/revocation", "Denied after expiry/revoke"),
        ("Contact attachment/metadata", "Inquiry record and private storage", "Administrators", "Institutional retention policy", "Inquiry persists when email fails"),
        ("Report export", "Ephemeral download response", "Administrator", "Do not persist unless explicitly archived", "Closed format/range error"),
        ("Experience Studio assets", "Configuration asset boundary", "Administrator/public published copy", "Versioned publish/rollback", "Invalid asset blocks publish"),
    ], [1.35, 1.65, 1.4, 1.55, 1.55], 8)

    add_heading(doc, "Appendix G: Test Cases, UAT Scripts, Results, and Limitations", 1)
    add_table(doc, ["Case", "Precondition", "Steps", "Expected result", "Result"], [
        ("UAT-01", "Public app reachable", "Search; filter; open author; preview", "Approved metadata and guest preview load", "Captured"),
        ("UAT-02", "Synthetic user account", "Login; read; save; annotate; history", "Private reader features persist", "Captured"),
        ("UAT-03", "Synthetic publisher account", "News edit; media; pending upload", "Ownership/capability boundaries hold", "Partial; upload assertions documented"),
        ("UAT-04", "Admin account", "Review; classify; reports; Studio", "Admin controls work", "Captured"),
        ("NEG-01", "No session", "Call protected endpoint", "401", "Route evidence"),
        ("NEG-02", "Wrong role", "Call admin endpoint as user/publisher", "403", "Route evidence"),
        ("NEG-03", "Invalid upload", "Submit non-PDF or malformed metadata", "Validation error; no publication", "Browser/unit coverage"),
        ("NEG-04", "Expired token", "Use expired/revoked download token", "Denied delivery", "Route/service coverage"),
        ("NEG-05", "Invalid report", "Use unsupported range/format", "Closed 400 error", "10 route tests"),
    ], [0.65, 1.2, 2.0, 1.7, 1.0], 8)
    add_para(doc, "Known limitations are intentionally retained: unavailable WebKit executable; public contrast and login-button styling assertions; publisher workspace copy; strict tooltip matching; and guided-upload expectation failures. These limitations are evidence about the current baseline, not defects hidden by the documentation process.")
    add_heading(doc, "Expanded UAT execution script", 2)
    add_table(doc, ["Case", "Minute 0–5", "Minute 5–10", "Minute 10–15", "Pass evidence"], [
        ("UAT-01", "Open home and search", "Apply category/author filters", "Open detail and guest preview", "Screens + public route log"),
        ("UAT-02", "Sign in synthetic user", "Open reader and save item", "Mark read, history, annotation", "Private state visible only to owner"),
        ("UAT-03", "Sign in publisher", "Edit owned news/media", "Start upload and submit review", "Pending state + 403 checks"),
        ("UAT-04", "Sign in admin", "Review/classify document", "Run report and export", "Admin response + file output"),
        ("NEG-01", "Open protected route logged out", "Inspect status/body", "Confirm no storage path", "401 and safe message"),
        ("NEG-02", "Use publisher on admin route", "Attempt role/report action", "Confirm no state change", "403 and audit evidence"),
        ("NEG-03", "Submit malformed/non-PDF", "Inspect validation", "Confirm no public record", "422/closed error"),
        ("NEG-04", "Use expired/revoked token", "Request stream", "Confirm denial and no bytes", "403/410 behavior"),
        ("NEG-05", "Use invalid range/format", "Call report/export", "Confirm pre-DB validation", "400 closed error"),
        ("A11Y-01", "Keyboard-only navigation", "Focus visible controls", "Check landmarks/labels", "Manual checklist + axe"),
        ("A11Y-02", "Reduced motion/contrast", "Inspect focus and colors", "Check alternative text", "Known contrast limitations recorded"),
    ], [0.7, 1.65, 1.65, 1.65, 1.4], 8)

    add_heading(doc, "Appendix H: Screenshot Register and Figure Inventory", 1)
    shot_rows = []
    for idx, (name, role, route, purpose, size) in enumerate([
        ("public-home-desktop.png", "Public visitor", "/index.html", "Home/discovery", "1440×900"),
        ("public-login-desktop.png", "Public visitor", "/login.html", "Login", "1440×900"),
        ("public-home-mobile.png", "Public visitor", "/index.html", "Responsive home", "390×844"),
        ("public-login-mobile.png", "Public visitor", "/login.html", "Responsive login", "390×844"),
        ("doc-user-2026-home.png", "Registered user", "/index.html", "Session-aware home", "1440×900"),
        ("doc-user-2026-search.png", "Registered user", "/search.html", "Search/filter", "1440×900"),
        ("doc-user-2026-profile.png", "Registered user", "/profile.html", "Profile", "1440×900"),
        ("doc-user-2026-saved.png", "Registered user", "/saved.html", "Saved items", "1440×900"),
        ("doc-user-2026-history.png", "Registered user", "/history.html", "History", "1440×900"),
        ("doc-user-2026-annotations.png", "Registered user", "/annotations.html", "Private annotations", "1440×900"),
        ("doc-publisher-2026-news-admin.png", "Publisher", "/admin/Components/news.html", "News workspace", "1440×900"),
        ("doc-publisher-2026-documents.png", "Publisher", "/admin/Components/documents.html", "Constrained document workspace", "1440×900"),
        ("admin-dashboard.png", "Administrator", "/admin/dashboard.html", "Dashboard", "1440×900"),
        ("admin-documents.png", "Administrator", "/admin/Components/documents.html", "Document catalog", "1440×900"),
        ("admin-reports.png", "Administrator", "/admin/Components/reports.html", "Reports", "1440×900"),
        ("admin-classification.png", "Administrator", "/admin/Components/classification.html", "Classification", "1440×900"),
        ("admin-news.png", "Administrator", "/admin/Components/news.html", "News", "1440×900"),
        ("admin-experience.png", "Administrator", "/admin/experience-studio.html", "Experience Studio", "1440×900"),
        ("admin-logs.png", "Administrator", "/admin/Components/logs.html", "Logs", "1440×900"),
        ("admin-roles.png", "Administrator", "/admin/Components/roles.html", "Roles", "1440×900"),
        ("admin-contact.png", "Administrator", "/admin/Components/contact.html", "Inquiries", "1440×900"),
        ("admin-settings.png", "Administrator", "/admin/settings.html", "Settings", "1440×900"),
    ]):
        shot_rows.append((name, role, route, purpose, size, control["generated"].split("T")[0]))
    add_table(doc, ["File", "Role", "Route/screen", "Purpose", "Viewport", "Capture date"], shot_rows, [1.55, 0.95, 1.45, 1.15, 0.7, 0.7], 7.3)
    add_para(doc, "All screenshots are stored under output/evidence/screenshots and were generated from the current local deployment using synthetic documentation accounts. No production identifiers are part of the register.")
    add_heading(doc, "Visual screen register", 2)
    add_para(doc, "The following visual register keeps the full capture set with the appendix so a reviewer can inspect each source screen rather than relying only on the compact table. Each image is preserved at its captured aspect ratio and is followed by its role, route, purpose, viewport, and capture date.")
    for name, role, route, purpose, size, captured in shot_rows:
        add_picture_with_caption(doc, SCREEN / name, f"{name} — {role}; {route}; {purpose}; {size}; captured {captured}.", 6.1)
        doc.add_page_break()

    add_heading(doc, "Appendix I: Feature-Status Register", 1)
    add_heading(doc, "Legacy and compatibility-route register", 2)
    add_table(doc, ["Route/behavior", "Audience", "Current treatment", "Removal/verification note"], [
        ("Legacy public path aliases", "Public", "Deprecated/compatibility; normalize to server-owned page key", "Retain during client soak; test redirect/alias"),
        ("Legacy author/page visit writers", "Internal", "Deprecated no-op", "Reporting route tests assert closed behavior"),
        ("Old document detail aliases", "Public", "Compatibility route where registered", "Do not expose private identifiers"),
        ("Legacy news path", "Publisher/admin", "Compatibility alias to current news workspace", "Remove after client migration"),
        ("Old role labels", "All", "Normalized to user/publisher/admin", "Backend normalization remains authoritative"),
        ("Pre-Better-Auth account records", "Internal", "Migrated/compatibility data only", "Do not describe as OrangeApp"),
        ("Legacy HTML-only entry description", "Documentation", "Legacy draft only", "Current React/shell architecture is authoritative"),
        ("MySQL configuration language", "Documentation", "Legacy draft only", "Current PostgreSQL schema is authoritative"),
        ("Implemented-Meilisearch wording", "Documentation", "Legacy draft only", "Current PostgreSQL search; Meilisearch planned"),
        ("Three-role wording", "Documentation", "Legacy draft only", "Use four audience model and capability matrix"),
    ], [1.65, 1.0, 2.2, 1.9], 8)
    add_table(doc, ["Feature", "Status", "Evidence", "Documentation treatment"], [
        ("PostgreSQL metadata search/autocomplete", "Implemented", "Search routes/services and UI captures", "Current runtime"),
        ("Meilisearch", "Planned", "No active adapter in baseline", "Future extension point"),
        ("Better Auth sessions", "Implemented", "Auth config/middleware and login", "Current runtime"),
        ("Microsoft Entra sign-in", "Configuration-gated", "Optional credentials in config", "Enabled only when configured"),
        ("Public/user/publisher/admin audiences", "Implemented", "Capability middleware and routes", "Backend matrix"),
        ("Document-level ACL depth", "Planned/design decision", "Broad roles and requests exist", "Explicit limitation"),
        ("Guest WebP preview", "Implemented", "Preview handler and screenshots", "Current runtime"),
        ("Authenticated PDF.js reader", "Implemented", "Reader UI and stream boundary", "Current runtime"),
        ("Abstract extraction", "Configuration-gated", "Worker and queue schema", "Worker-dependent"),
        ("Media processing", "Configuration-gated", "Media worker and variants", "Worker-dependent"),
        ("Compatibility aliases", "Deprecated/compatibility", "Legacy route register", "Retained temporarily"),
        ("MySQL / OrangeApp / HTML-only claims", "Legacy draft only", "Conflicts with current source", "Removed or labeled historical"),
    ], [1.8, 1.3, 2.0, 1.4], 8.3)

    add_heading(doc, "Appendix J: Revision History and Documentation Maintenance Checklist", 1)
    add_table(doc, ["Version", "Date", "Change", "Evidence"], [
        ("1.0", control["generated"].split("T")[0], "As-built PeAS documentation produced from current code, schema, tests, deployment, and synthetic screenshots.", control["commit"]),
        ("Legacy draft", "Undated source PDF", "Structural sample only; obsolete implementation claims not authoritative.", control["source_pdf"][:16]),
    ], [0.8, 1.1, 3.6, 1.0], 8.5)
    add_bullets(doc, [
        "Re-record commit, branch, working-tree status, generation time, source hashes, and test logs for each edition.",
        "Reconcile API, schema/migration, role/capability, feature-status, compatibility-route, storage, and retention inventories.",
        "Rerun type, unit, database, route, browser, accessibility, and UAT checks; record failures honestly.",
        "Capture only synthetic screenshots at consistent viewports; remove tokens, names, emails, and paths.",
        "Update figure/table captions, cross-references, ToC/list fields, APA 7 citations, and one-to-one reference audit.",
        "Render DOCX and PDF, inspect every page for clipping/orphans/legibility, compare hashes and page counts, and archive the evidence manifest.",
    ])
    add_heading(doc, "Documentation release checklist", 2)
    add_table(doc, ["Check", "Owner", "Evidence to retain", "Pass condition"], [
        ("Baseline", "Documentation maintainer", "Commit, branch, status, timestamp", "Matches document-control page"),
        ("Source hashes", "Documentation maintainer", "Hash manifest", "Principal files and source PDF recorded"),
        ("Claims", "Technical reviewer", "Claim ledger", "Every technical claim has evidence/status"),
        ("Schema/API", "Backend reviewer", "Migration and API inventories", "Tables/routes reconcile with source"),
        ("Roles", "Security reviewer", "Capability matrix", "Backend enforcement, not UI visibility"),
        ("Screenshots", "UX reviewer", "Synthetic dataset and register", "No PII, tokens, paths, or stale screens"),
        ("Tests", "QA reviewer", "Command logs and result summary", "Exact commands and limitations included"),
        ("Citations", "Academic reviewer", "APA audit", "Every in-text citation maps to one reference"),
        ("DOCX structure", "Document owner", "Rendered PNGs", "Styles, captions, fields, and bookmarks present"),
        ("PDF output", "Document owner", "Rendered PDF PNGs", "No clipping, overlap, or unreadable tables"),
        ("Handoff", "Document owner", "Sizes and SHA-256", "DOCX/PDF paths and hashes recorded"),
    ], [1.55, 1.35, 2.1, 1.5], 8)
    add_heading(doc, "Maintenance cadence", 2)
    add_table(doc, ["Trigger", "Required documentation action", "Do not close until"], [
        ("Database migration", "Update data dictionary, migration inventory, ERD interpretation, and retention notes", "DB tests and schema review pass"),
        ("New route/capability", "Update API inventory, role matrix, claim ledger, UAT, and negative cases", "401/403 behavior is evidenced"),
        ("Reader workflow change", "Refresh screenshots, privacy statement, and source-hash/annotation notes", "Owner-private behavior is verified"),
        ("Reporting definition change", "Update canonical definitions, Manila ranges, exports, and report tests", "DB/route/unit evidence is current"),
        ("Worker/deployment change", "Update runtime/deployment diagrams, health checks, environment, backup guidance", "Compose health and failure behavior are recorded"),
        ("UI navigation change", "Re-capture role-scoped screens and accessibility checks", "All four audiences remain represented"),
        ("Release or major refactor", "Regenerate document-control page, hashes, tests, and handoff note", "DOCX/PDF render and acceptance audit pass"),
    ], [1.5, 3.3, 1.7], 8)
    add_heading(doc, "Evidence index", 2)
    add_table(doc, ["Evidence ID", "Artifact", "What it supports", "Location"], [
        ("E-01", "baseline.txt", "Commit, branch, source hashes, Docker state", "output/evidence/baseline.txt"),
        ("E-02", "check-deno.txt", "Deno type-check result", "output/evidence/check-deno.txt"),
        ("E-03", "check-ui.txt", "UI type-check result", "output/evidence/check-ui.txt"),
        ("E-04", "test-deno.txt", "101 unit tests", "output/evidence/test-deno.txt"),
        ("E-05", "classification-db.txt", "Classification transaction fixture", "output/evidence/classification-db.txt"),
        ("E-06", "reporting-db.txt", "Reporting schema/fixture/backfill/report", "output/evidence/reporting-db.txt"),
        ("E-07", "reporting-routes.txt", "Reporting route preconditions", "output/evidence/reporting-routes.txt"),
        ("E-08", "reporting-unit.txt", "Canonical/report/export/top-activity tests", "output/evidence/reporting-unit.txt"),
        ("E-09", "test-public-18080.txt", "Public browser execution and limitations", "output/evidence/test-public-18080.txt"),
        ("E-10", "test-admin-18080.txt", "Administrator browser execution and limitations", "output/evidence/test-admin-18080.txt"),
        ("E-11", "test-experience-18080.txt", "Experience Studio desktop/mobile smoke", "output/evidence/test-experience-18080.txt"),
        ("E-12", "diagrams/", "Print-resolution architecture figures", "output/evidence/diagrams/"),
        ("E-13", "screenshots/", "Synthetic current UI captures", "output/evidence/screenshots/"),
        ("E-14", "docx_render_final/", "DOCX page render QA", "output/evidence/docx_render_final/"),
        ("E-15", "pdf_render_final/", "Final PDF page render QA", "output/evidence/pdf_render_final/"),
        ("E-16", "documentation_manifest.json", "Generated artifact inventory", "output/evidence/documentation_manifest.json"),
        ("E-17", "handoff.txt", "Final page count, sizes, hashes", "output/evidence/handoff.txt"),
        ("E-18", "Deno/server.ts hash", "Runtime entry point baseline", "Document-control hash list"),
        ("E-19", "authMiddleware.ts hash", "Capability boundary baseline", "Document-control hash list"),
        ("E-20", "operationalReportingService.ts hash", "Reporting definitions baseline", "Document-control hash list"),
    ], [0.7, 1.7, 2.6, 1.2], 8)


def build_control():
    baseline = EVID / "baseline.txt"
    text = baseline.read_text(errors="ignore") if baseline.exists() else ""
    def pick(pattern, fallback="Not recorded"):
        m = re.search(pattern, text, re.I | re.M)
        return m.group(1).strip() if m else fallback
    source = ROOT / "Paulinian electronic Archiving System (PeAS).pdf"
    return {
        "commit": pick(r"^commit:\s*(.+)$", "143caa0"),
        "branch": pick(r"^branch:\s*(.+)$", "peas-main"),
        "generated": datetime.now(ZoneInfo("Asia/Manila")).isoformat(timespec="seconds"),
        "source_pdf": sha256(source),
    }


def build_doc():
    for d in (DOCX_DIR, PDF_DIR, EVID, SCREEN, DIAGRAMS): d.mkdir(parents=True, exist_ok=True)
    make_diagrams()
    control = build_control()
    doc = Document()
    configure_styles(doc)
    add_footer(doc.sections[0])
    add_title_page(doc)
    add_front_matter(doc, control)
    add_summary_sections(doc)
    add_architecture_sections(doc)
    add_testing(doc, control)
    add_appendices(doc, control)
    # Update fields on open in Word/LibreOffice.
    settings = doc.settings._element
    update = OxmlElement("w:updateFields")
    update.set(qn("w:val"), "true")
    settings.append(update)
    doc.core_properties.title = "PeAS System Documentation"
    doc.core_properties.subject = "As-built capstone system documentation"
    doc.core_properties.author = "Christian James B. Anadon; James Dale A. Grafe; Kurt Dustine L. Yrad"
    doc.core_properties.keywords = "PeAS, SPUD, repository, documentation"
    doc.save(DOCX_PATH)
    manifest = {
        "generated": control["generated"],
        "commit": control["commit"],
        "branch": control["branch"],
        "source_pdf_sha256": control["source_pdf"],
        "docx": str(DOCX_PATH),
        "screenshots": sorted(p.name for p in SCREEN.glob("*.png")),
        "diagrams": sorted(p.name for p in DIAGRAMS.glob("*.png")),
        "evidence_files": sorted(str(p.relative_to(OUT)) for p in EVID.glob("*.txt")),
    }
    (EVID / "documentation_manifest.json").write_text(json.dumps(manifest, indent=2))
    print(json.dumps({"docx": str(DOCX_PATH), "bytes": DOCX_PATH.stat().st_size, "manifest": str(EVID / "documentation_manifest.json")}, indent=2))


if __name__ == "__main__":
    build_doc()
