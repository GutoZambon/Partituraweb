#!/usr/bin/env python3
import sys
import xml.etree.ElementTree as ET
import music21

# Mapeamentos extraídos do script Python original (QML / music21)
# Chave = MIDI note - 18
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

def process_xml_file(xml_path, instrument_name, add_fingerings=True, add_note_names=True, add_key=True, transpose_sol_fa=True):
    score = music21.converter.parse(xml_path)
    
    # 1. Transposição Clave de Sol -> Fá (-9M) para Bombardino e Trombone
    if transpose_sol_fa and instrument_name in ["Bombardino", "Trombone"]:
        has_treble = any(c.sign == 'G' for c in score.recurse().getElementsByClass('Clef'))
        if has_treble:
            score.transpose('-M9', inPlace=True)
            for c in score.recurse().getElementsByClass('Clef'):
                if c.sign == 'G':
                    nova_clave = music21.clef.BassClef()
                    if c.activeSite is not None:
                        c.activeSite.replace(c, nova_clave)

    # 2. Tom da Música
    key_signatures = list(score.recurse().getElementsByClass('KeySignature'))
    detected_key = "Desconhecido"
    if key_signatures:
        ks = key_signatures[0]
        fifths = ks.sharps
        mode = getattr(ks, 'mode', 'major') or 'major'
        detected_key = FIFTHS_MINOR.get(fifths, f"{fifths} acidentes (menor)") if mode == 'minor' else FIFTHS_MAJOR.get(fifths, f"{fifths} acidentes")

    if add_key and detected_key != "Desconhecido":
        measures = list(score.recurse().getElementsByClass('Measure'))
        if measures:
            m1 = measures[0]
            tb = music21.text.TextExpression(f"Tom: {detected_key}")
            tb.style.fontSize = 11
            tb.style.fontWeight = 'bold'
            m1.insert(0, tb)

    # 3. Pistos e Nomes das Notas
    mapa = MAPEAMENTOS.get(instrument_name)
    
    # Iterar especificamente sobre as notas (inclui acordes)
    for nota in score.recurse().notes:
        if nota.isNote:
            nota.lyrics = [] # Limpa sujeiras do XML original
            
            if add_note_names:
                nome_pt = obter_nome_pt(nota.pitch)
                nota.addLyric(nome_pt, lyricNumber=1)
                
            if add_fingerings and mapa:
                chave_qml = nota.pitch.midi - 18
                dedilhado = mapa.get(chave_qml)
                if dedilhado:
                    nota.addLyric(dedilhado, lyricNumber=2)
                    
        elif nota.isChord:
            nota.lyrics = [] # Limpa sujeiras do XML original
            
            # Processa a primeira nota do acorde (resolve o bug do Audiveris)
            for n in nota:
                if add_note_names:
                    nome_pt = obter_nome_pt(n.pitch)
                    nota.addLyric(nome_pt, lyricNumber=1) # Adiciona no objeto 'nota' (acorde) para alinhar
                    
                if add_fingerings and mapa:
                    chave_qml = n.pitch.midi - 18
                    dedilhado = mapa.get(chave_qml)
                    if dedilhado:
                        nota.addLyric(dedilhado, lyricNumber=2)
                break # Garante que apenas a nota principal receba texto

    # Exportar MusicXML
    out_path = xml_path + ".processed.xml"
    score.write('musicxml', fp=out_path)
    return out_path, detected_key

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: process_score.py <caminho_xml> <instrumento>")
        sys.exit(1)
    
    xml_p = sys.argv[1]
    inst = sys.argv[2]
    out_p, key_name = process_xml_file(xml_p, inst)
    print(f"KEY:{key_name}")
    print(f"OUT:{out_p}")
