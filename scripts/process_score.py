#!/usr/bin/env python3
import sys
import os
import subprocess
import shutil
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import music21

# Dicionários de digitação (MIDI - 18)
MAPA_TROMPETE = {
    34: "1-2-3", 35: "1-3", 36: "2-3", 37: "1-2", 38: "1", 39: "2", 40: "0",
    41: "1-2-3", 42: "1-3", 43: "2-3", 44: "1-2", 45: "1", 46: "2", 47: "0",
    48: "2-3", 49: "1-2", 50: "1", 51: "2", 52: "0", 53: "1-2", 54: "1",
    55: "2", 56: "0", 57: "1", 58: "2", 59: "0", 60: "2-3", 61: "1-2",
    62: "1", 63: "2", 64: "0", 65: "2", 66: "1"
}

MAPA_TROMBONE = {
    23: "6", 24: "5", 25: "4", 26: "3", 27: "2", 28: "1", 29: "7", 30: "6",
    31: "5", 32: "4", 33: "3", 34: "2", 35: "1", 36: "5", 37: "4", 38: "3",
    39: "2", 40: "1", 41: "4", 42: "3", 43: "2", 44: "1", 45: "3", 46: "2",
    47: "1", 48: "3", 49: "2", 50: "3", 51: "1"
}

MAPA_TUBA = {
    10: "1-2-3", 11: "1-3", 12: "2-3", 13: "1-2", 14: "1", 15: "2", 16: "0",
    17: "1-2-3", 18: "1-3", 19: "2-3", 20: "1-2", 21: "1", 22: "2", 23: "0",
    24: "2-3", 25: "1-2", 26: "1", 27: "2", 28: "0", 29: "1-2", 30: "1",
    31: "2", 32: "0", 33: "1", 34: "2", 35: "0", 36: "2-3", 37: "1-2",
    38: "1", 39: "2", 40: "0", 41: "2", 42: "1"
}

MAPA_BOMBARDINO = {
    17: "1-2-3-4", 18: "1-3-4", 19: "2-3-4", 20: "1-2-4", 21: "1-4",
    22: "1-2-3", 23: "1-3", 24: "2-3", 25: "1-2", 26: "1", 27: "2",
    28: "0", 29: "1-2-3", 30: "1-3", 31: "2-3", 32: "1-2", 33: "1",
    34: "2", 35: "0", 36: "2-3", 37: "1-2", 38: "1", 39: "2", 40: "0",
    41: "1-2", 42: "1", 43: "2", 44: "0", 45: "1", 46: "2", 47: "0",
    48: "2-3", 49: "1-2", 50: "1", 51: "2", 52: "0", 53: "2", 54: "1"
}

MAPEAMENTOS = {
    "Trompete": MAPA_TROMPETE,
    "Trombone": MAPA_TROMBONE,
    "Tuba": MAPA_TUBA,
    "Bombardino": MAPA_BOMBARDINO
}

NOTAS_PT = {
    'C': 'Dó', 'D': 'Ré', 'E': 'Mi', 'F': 'Fá', 'G': 'Sol', 'A': 'Lá', 'B': 'Si'
}

FIFTHS_MAJOR = {
    0: 'Dó Maior', 1: 'Sol Maior', 2: 'Ré Maior', 3: 'Lá Maior',
    4: 'Mi Maior', 5: 'Si Maior', 6: 'Fá# Maior', 7: 'Dó# Maior',
    -1: 'Fá Maior', -2: 'Si♭ Maior', -3: 'Mi♭ Maior', -4: 'Lá♭ Maior',
    -5: 'Ré♭ Maior', -6: 'Sol♭ Maior', -7: 'Dó♭ Maior'
}

FIFTHS_MINOR = {
    0: 'Lá menor', 1: 'Mi menor', 2: 'Si menor', 3: 'Fá# menor',
    4: 'Dó# menor', 5: 'Sol# menor', 6: 'Ré# menor', 7: 'Lá# menor',
    -1: 'Ré menor', -2: 'Sol menor', -3: 'Dó menor', -4: 'Fá menor',
    -5: 'Si♭ menor', -6: 'Mi♭ menor', -7: 'Lá♭ menor'
}

def debug(msg):
    print(f"[PYTHON DEBUG] {msg}", file=sys.stderr)

def obter_nome_pt(pitch):
    step = pitch.step
    acc = pitch.accidental
    nome = NOTAS_PT.get(step, step)
    if acc is not None:
        if acc.alter == 1:
            nome += '#'
        elif acc.alter == -1:
            nome += 'b'
        elif acc.alter == 2:
            nome += '##'
        elif acc.alter == -2:
            nome += 'bb'
    return nome

def criar_estilo_cadernin(pasta_saida):
    """Arquivo de estilo compacto para o formato Kindle (296.93 x 170.00 mm)."""
    estilo_xml = """<?xml version="1.0" encoding="UTF-8"?>
<museScore version="3.01">
  <Style>
    <pageWidth>11.6902</pageWidth>
    <pageHeight>6.69291</pageHeight>
    <pagePrintableWidth>11.2965</pagePrintableWidth>
    <pageEvenLeftMargin>0.19685</pageEvenLeftMargin>
    <pageOddLeftMargin>0.19685</pageOddLeftMargin>
    <pageEvenTopMargin>0.19685</pageEvenTopMargin>
    <pageEvenBottomMargin>0</pageEvenBottomMargin>
    <pageOddTopMargin>0.19685</pageOddTopMargin>
    <pageOddBottomMargin>0</pageOddBottomMargin>
    <staffUpperBorder>3.0</staffUpperBorder>
    <staffLowerBorder>2.0</staffLowerBorder>
    <staffDistance>4.0</staffDistance>
    <minSystemDistance>4.5</minSystemDistance>
    <maxSystemDistance>7.5</maxSystemDistance>
    <lyricsPosBelow x="0" y="2.5"/>
    <lyricsOddFontSize>9</lyricsOddFontSize>
    <lyricsEvenFontSize>9</lyricsEvenFontSize>
    <enableIndentationOnFirstSystem>0</enableIndentationOnFirstSystem>
    <showHeader>0</showHeader>
    <showFooter>0</showFooter>
    <spatium>1.778</spatium>
  </Style>
</museScore>"""
    caminho = Path(pasta_saida) / "estilo_cadernin.mss"
    caminho.write_text(estilo_xml, encoding='utf-8')
    return caminho

def criar_estilo_a5(pasta_saida):
    """Arquivo de estilo para Caderninho A5 Paisagem."""
    estilo_xml = """<?xml version="1.0" encoding="UTF-8"?>
<museScore version="3.01">
  <Style>
    <pageWidth>8.26772</pageWidth>
    <pageHeight>5.82677</pageHeight>
    <pageEvenLeftMargin>0.25</pageEvenLeftMargin>
    <pageOddLeftMargin>0.25</pageOddLeftMargin>
    <pageEvenTopMargin>0.25</pageEvenTopMargin>
    <pageEvenBottomMargin>0.25</pageEvenBottomMargin>
    <pageOddTopMargin>0.25</pageOddTopMargin>
    <pageOddBottomMargin>0.25</pageOddBottomMargin>
    <showHeader>0</showHeader>
    <showFooter>0</showFooter>
    <spatium>1.65</spatium>
  </Style>
</museScore>"""
    caminho = Path(pasta_saida) / "estilo_a5.mss"
    caminho.write_text(estilo_xml, encoding='utf-8')
    return caminho

def preparar_xml_cadernin(caminho_xml):
    """Ajusta o MusicXML para Paisagem 296.93 x 170 mm e insere título compacto no topo."""
    tree = ET.parse(str(caminho_xml))
    root = tree.getroot()

    titulo_musica = ""
    mov_title = root.find('movement-title')
    if mov_title is not None and mov_title.text:
        titulo_musica = mov_title.text.strip()

    if not titulo_musica:
        for credit in root.findall('credit'):
            cw = credit.find('credit-words')
            if cw is not None and cw.text:
                texto = cw.text.strip()
                if texto not in ["Tuba", "Trombone", "Trompete", "Bombardino", "Fanfarra Xamego"] and not texto.isdigit():
                    titulo_musica = texto
                    break

    if not titulo_musica:
        titulo_musica = Path(caminho_xml).stem.replace("_pistos", "").replace("_notas", "").replace("_linha_baixo", "").replace("-Tuba", "").replace("_", " ").strip()

    defaults = root.find('defaults')
    if defaults is None:
        defaults = ET.Element('defaults')
        root.insert(0, defaults)

    page_layout = defaults.find('page-layout')
    if page_layout is None:
        page_layout = ET.SubElement(defaults, 'page-layout')
    else:
        for child in list(page_layout):
            page_layout.remove(child)

    ET.SubElement(page_layout, 'page-width').text = '1670'
    ET.SubElement(page_layout, 'page-height').text = '956'

    for tipo in ['odd', 'even']:
        margins = ET.SubElement(page_layout, 'page-margins', type=tipo)
        ET.SubElement(margins, 'left-margin').text = '28'
        ET.SubElement(margins, 'right-margin').text = '28'
        ET.SubElement(margins, 'top-margin').text = '28'
        ET.SubElement(margins, 'bottom-margin').text = '0'

    for credit in list(root.findall('credit')):
        root.remove(credit)

    if mov_title is not None:
        root.remove(mov_title)

    work = root.find('work')
    if work is not None:
        root.remove(work)

    part = root.find('part')
    if part is not None:
        compassos = part.findall('measure')
        if compassos:
            p = compassos[0].find('print')
            if p is not None:
                sys_layout = p.find('system-layout')
                if sys_layout is not None:
                    top_dist = sys_layout.find('top-system-distance')
                    if top_dist is not None:
                        sys_layout.remove(top_dist)

    novo_credit = ET.Element('credit', page='1')
    novo_words = ET.SubElement(novo_credit, 'credit-words', {
        'default-x': '835',
        'default-y': '935',
        'font-family': 'Edwin',
        'font-size': '14',
        'font-weight': 'bold',
        'justify': 'center',
        'valign': 'top'
    })
    novo_words.text = titulo_musica

    part_idx = list(root).index(part) if part in list(root) else len(list(root))
    root.insert(part_idx, novo_credit)

    caminho_temp = Path(caminho_xml).with_name(f"{Path(caminho_xml).stem}_cadernin_temp.xml")
    tree.write(str(caminho_temp), encoding='utf-8', xml_declaration=True)
    return caminho_temp

def aplicar_anotacoes(xml_path, modo_ou_instrumento):
    """Executa a rotina do music21 dependendo da escolha do usuário."""
    score = music21.converter.parse(xml_path)

    # 1. Detectar Tom
    key_signatures = list(score.recurse().getElementsByClass('KeySignature'))
    detected_key = "Desconhecido"
    if key_signatures:
        ks = key_signatures[0]
        fifths = ks.sharps
        mode = getattr(ks, 'mode', 'major') or 'major'
        detected_key = FIFTHS_MINOR.get(fifths, f"{fifths} acidentes") if mode == 'minor' else FIFTHS_MAJOR.get(fifths, f"{fifths} acidentes")

    # Se for "Apenas Formatação", não adiciona Tom no compasso nem letras de notas
    if modo_ou_instrumento != "Apenas Formatação" and detected_key != "Desconhecido":
        measures = list(score.recurse().getElementsByClass('Measure'))
        if measures:
            tb = music21.expressions.TextExpression(f"Tom: {detected_key}")
            tb.style.fontSize = 11
            tb.style.fontWeight = 'bold'
            measures[0].insert(0, tb)

    # 2. Transposição Clave Sol -> Fá para Bombardino e Trombone
    if modo_ou_instrumento in ["Bombardino", "Trombone"]:
        has_treble = any(c.sign == 'G' for c in score.recurse().getElementsByClass('Clef'))
        if has_treble:
            score.transpose('-M9', inPlace=True)
            for c in score.recurse().getElementsByClass('Clef'):
                if c.sign == 'G':
                    nova_clave = music21.clef.BassClef()
                    if c.activeSite is not None:
                        c.activeSite.replace(c, nova_clave)

    # 3. Anotação de Notas e Pistos
    if modo_ou_instrumento != "Apenas Formatação":
        adicionar_pistos = modo_ou_instrumento not in ["Apenas Notas"]
        mapa = MAPEAMENTOS.get(modo_ou_instrumento)

        for nota in score.recurse().notes:
            if nota.isNote:
                nota.lyrics = []
                nome_pt = obter_nome_pt(nota.pitch)
                nota.addLyric(nome_pt, lyricNumber=1)

                if adicionar_pistos and mapa:
                    chave = nota.pitch.midi - 18
                    dedilhado = mapa.get(chave)
                    if dedilhado:
                        nota.addLyric(dedilhado, lyricNumber=2)

            elif nota.isChord:
                nota.lyrics = []
                for n in nota:
                    nome_pt = obter_nome_pt(n.pitch)
                    nota.addLyric(nome_pt, lyricNumber=1)
                    if adicionar_pistos and mapa:
                        chave = n.pitch.midi - 18
                        dedilhado = mapa.get(chave)
                        if dedilhado:
                            nota.addLyric(dedilhado, lyricNumber=2)
                    break

    out_path = Path(xml_path).with_name(f"{Path(xml_path).stem}_processado.xml")
    score.write('musicxml', fp=str(out_path))
    return str(out_path), detected_key

def main():
    if len(sys.argv) < 3:
        debug("Uso: process_score.py <caminho_xml> <modo_ou_instrumento> [pasta_saida]")
        sys.exit(1)

    xml_input = sys.argv[1]
    modo = sys.argv[2]
    pasta_saida = Path(sys.argv[3]) if len(sys.argv) > 3 else Path(xml_input).parent
    base_name = Path(xml_input).stem.replace(".mxl", "").replace(".xml", "")

    # 1. Processar XML com anotações e tom
    xml_processado, tom = aplicar_anotacoes(xml_input, modo)
    
    # Executável do MuseScore (detecta container Linux ou local)
    musescore_bin = "musescore3" if shutil.which("musescore3") else "musescore"
    use_xvfb = shutil.which("xvfb-run") is not None

    def run_ms(cmd_list):
        if use_xvfb:
            cmd = ["xvfb-run", "-a"] + cmd_list
        else:
            cmd = cmd_list
        subprocess.run(cmd, capture_output=True, text=True, errors='replace')

    # 2. Renderizar Normal A4
    pdf_normal = pasta_saida / f"{base_name}_NORMAL_A4.pdf"
    run_ms([musescore_bin, xml_processado, "-o", str(pdf_normal)])

    # 3. Renderizar Caderninho A5
    estilo_a5 = criar_estilo_a5(pasta_saida)
    pdf_a5 = pasta_saida / f"{base_name}_CADERNINHO_A5.pdf"
    run_ms([musescore_bin, xml_processado, "-S", str(estilo_a5), "-o", str(pdf_a5)])

    # 4. Renderizar Kindle Cadernin (296.93 x 170 mm)
    xml_kindle_temp = preparar_xml_cadernin(xml_processado)
    estilo_kindle = criar_estilo_cadernin(pasta_saida)
    pdf_kindle = pasta_saida / f"{base_name}_KINDLE_CADERNIN.pdf"
    run_ms([musescore_bin, str(xml_kindle_temp), "-S", str(estilo_kindle), "-o", str(pdf_kindle)])

    if Path(xml_kindle_temp).exists():
        Path(xml_kindle_temp).unlink(missing_ok=True)

    # 5. Renderizar MIDI
    mid_file = pasta_saida / f"{base_name}.mid"
    run_ms([musescore_bin, xml_processado, "-o", str(mid_file)])

    # 6. Criar Arquivo ZIP com todo o pacote
    zip_path = pasta_saida / f"{base_name}_pacote_completo.zip"
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        if Path(xml_processado).exists():
            zipf.write(xml_processado, arcname=f"{base_name}_EDITAVEL.xml")
        if pdf_normal.exists():
            zipf.write(pdf_normal, arcname=pdf_normal.name)
        if pdf_a5.exists():
            zipf.write(pdf_a5, arcname=pdf_a5.name)
        if pdf_kindle.exists():
            zipf.write(pdf_kindle, arcname=pdf_kindle.name)
        if mid_file.exists():
            zipf.write(mid_file, arcname=mid_file.name)

    # Saídas padronizadas para o backend capturar
    print(f"KEY:{tom}")
    print(f"OUT:{xml_processado}")
    print(f"ZIP:{zip_path}")

if __name__ == "__main__":
    main()