import os
import subprocess
import shutil
import unicodedata
from pathlib import Path
import music21

# Dicionários extraídos do QML. 
# A chave representa o valor do 'case' no QML (Calculado via: MIDI da nota - 18).
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

def remover_acentos(txt):
    """Remove acentos de uma string para evitar bugs no Audiveris/Java."""
    return ''.join(c for c in unicodedata.normalize('NFD', txt) if unicodedata.category(c) != 'Mn')

def criar_estilo_a5(pasta_saida):
    """Cria um arquivo de estilo do MuseScore (.mss) para forçar a formatação A5 Paisagem."""
    estilo_xml = """<?xml version="1.0"?>
<museScore version="3.01">
  <Style>
    <pageWidth>8.26772</pageWidth> <!-- 210mm -->
    <pageHeight>5.82677</pageHeight> <!-- 148mm -->
    <pagePrintableWidth>7.48031</pagePrintableWidth>
    <pageEvenLeftMargin>0.393701</pageEvenLeftMargin>
    <pageOddLeftMargin>0.393701</pageOddLeftMargin>
    <pageEvenTopMargin>0.393701</pageEvenTopMargin>
    <pageEvenBottomMargin>0.393701</pageEvenBottomMargin>
    <pageOddTopMargin>0.393701</pageOddTopMargin>
    <pageOddBottomMargin>0.393701</pageOddBottomMargin>
    <Spatium>1.75</Spatium>
  </Style>
</museScore>"""
    caminho_estilo = pasta_saida / "estilo_a5.mss"
    caminho_estilo.write_text(estilo_xml, encoding='utf-8')
    return caminho_estilo

def executar_audiveris(caminho_pdf, pasta_saida, executavel_audiveris):
    """Executa o Audiveris em modo headless para converter PDF em MXL."""
    print(f"[{caminho_pdf.name}] Iniciando OMR via Audiveris...")
    
    nome_seguro = remover_acentos(caminho_pdf.name)
    caminho_seguro = caminho_pdf
    
    if nome_seguro != caminho_pdf.name:
        caminho_seguro = pasta_saida / nome_seguro
        shutil.copy(caminho_pdf, caminho_seguro)
        print(f"  -> Arquivo copiado temporariamente para {nome_seguro} (evitando erro de acentuação).")

    comando = [
        executavel_audiveris,
        "-batch",
        "-export",
        "-output", str(pasta_saida),
        str(caminho_seguro)
    ]
    
    subprocess.run(comando, capture_output=True, text=True, encoding='utf-8', errors='replace')
    
    if caminho_seguro != caminho_pdf:
        caminho_seguro.unlink(missing_ok=True)
    
    mxl_gerados = list(pasta_saida.glob(f"{caminho_seguro.stem}*.mxl"))
    
    mxl_finais = []
    for mxl in mxl_gerados:
        if "_pistos" in mxl.name or "_notas" in mxl.name or "_linha_baixo" in mxl.name:
            continue
        
        if caminho_seguro != caminho_pdf:
            novo_nome = mxl.name.replace(caminho_seguro.stem, caminho_pdf.stem)
            mxl_renomeado = mxl.with_name(novo_nome)
            if mxl_renomeado.exists():
                mxl_renomeado.unlink()
            mxl.rename(mxl_renomeado)
            mxl_finais.append(mxl_renomeado)
        else:
            mxl_finais.append(mxl)
            
    if mxl_finais:
        return mxl_finais
    else:
        print(f"Erro Crítico: O Audiveris falhou e não gerou arquivos .mxl para {caminho_pdf.name}.")
        return []

def gerar_baixo(caminho_xml):
    """Lê uma partitura melódica e gera uma linha de baixo baseada nas cifras ou na primeira nota do compasso."""
    print(f"[{caminho_xml.name}] Gerando linha de baixo (Tuba)...")
    try:
        score_original = music21.converter.parse(str(caminho_xml))
        score_baixo = music21.stream.Score()
        
        if score_original.metadata:
            score_baixo.insert(0, score_original.metadata)
            
        part_baixo = music21.stream.Part()
        part_baixo.append(music21.clef.BassClef())
        
        primeira_parte = score_original.parts[0]
        ts = primeira_parte.flat.getElementsByClass('TimeSignature').first()
        ks = primeira_parte.flat.getElementsByClass('KeySignature').first()
        if ts: part_baixo.append(ts)
        if ks: part_baixo.append(ks)

        acorde_atual = None
        
        for compasso in primeira_parte.getElementsByClass('Measure'):
            novo_compasso = music21.stream.Measure(number=compasso.number)
            
            cifras = list(compasso.getElementsByClass('ChordSymbol'))
            if cifras:
                acorde_atual = cifras[0]
                
            notas = list(compasso.notes)
            duracao_compasso = compasso.barDuration.quarterLength
            
            if acorde_atual:
                nota_baixo = music21.note.Note(acorde_atual.root().name + "2")
                nota_baixo.quarterLength = duracao_compasso
                novo_compasso.append(nota_baixo)
            elif notas and isinstance(notas[0], music21.note.Note):
                nota_baixo = music21.note.Note(notas[0].pitch.name + "2")
                nota_baixo.quarterLength = duracao_compasso
                novo_compasso.append(nota_baixo)
            else:
                pausa = music21.note.Rest(quarterLength=duracao_compasso)
                novo_compasso.append(pausa)
                
            part_baixo.append(novo_compasso)
            
        score_baixo.append(part_baixo)
        
        caminho_baixo = caminho_xml.with_name(f"{caminho_xml.stem}_linha_baixo.xml")
        score_baixo.write('musicxml', fp=str(caminho_baixo))
        return caminho_baixo
        
    except Exception as e:
        print(f"Erro ao gerar baixo para {caminho_xml.name}: {e}")
        return None

def aplicar_dedilhado(caminho_mxl, instrumento):
    print(f"[{caminho_mxl.name}] Aplicando anotações para {instrumento}...")
    
    mapa = MAPEAMENTOS.get(instrumento)
    MAPA_NOTAS_PT = {'C': 'Dó', 'D': 'Ré', 'E': 'Mi', 'F': 'Fá', 'G': 'Sol', 'A': 'Lá', 'B': 'Si'}
    
    def obter_nome_pt(pitch):
        nome = MAPA_NOTAS_PT.get(pitch.step, pitch.step)
        if pitch.accidental:
            if pitch.accidental.name == 'sharp':
                nome += '#'
            elif pitch.accidental.name == 'flat':
                nome += 'b'
        return nome

    try:
        score = music21.converter.parse(str(caminho_mxl))

        if instrumento in ["Bombardino", "Trombone"]:
            tem_clave_sol = any(c.sign == 'G' for c in score.recurse().getElementsByClass('Clef'))
            
            if tem_clave_sol:
                print(f"   -> Clave de Sol detectada. Transpondo partitura para Clave de Fá (-M9)...")
                score.transpose('-M9', inPlace=True)
                
                for c in score.recurse().getElementsByClass('Clef'):
                    if c.sign == 'G':
                        nova_clave = music21.clef.BassClef()
                        if c.activeSite is not None:
                            c.activeSite.replace(c, nova_clave)

        for nota in score.recurse().notes:
            if nota.isNote:
                nome_nota_pt = obter_nome_pt(nota.pitch)
                nota.addLyric(nome_nota_pt, lyricNumber=1)
                
                if mapa:
                    chave_qml = nota.pitch.midi - 18
                    dedilhado = mapa.get(chave_qml)
                    if dedilhado:
                        nota.addLyric(dedilhado, lyricNumber=2)
                        
            elif nota.isChord:
                for n in nota:
                    nome_nota_pt = obter_nome_pt(n.pitch)
                    nota.addLyric(nome_nota_pt, lyricNumber=1)
                    
                    if mapa:
                        chave_qml = n.pitch.midi - 18
                        dedilhado = mapa.get(chave_qml)
                        if dedilhado:
                            nota.addLyric(dedilhado, lyricNumber=2)
                    break 

        sufixo = "_notas" if instrumento == "Apenas Notas" else "_pistos"
        xml_editado = caminho_mxl.with_name(f"{caminho_mxl.stem}{sufixo}.xml")
        
        score.write('musicxml', fp=str(xml_editado))
        return xml_editado
    except Exception as e:
        print(f"Erro ao processar XML: {e}")
        return None

def executar_musescore(caminho_xml, executavel_musescore, pasta_saida):
    """Renderiza o arquivo XML para PDF (Normal e Caderninho) e tenta exportar MIDI."""
    print(f"[{caminho_xml.name}] Renderizando saídas via MuseScore...")
    
    pdf_final = caminho_xml.with_name(f"{caminho_xml.stem}_FINAL.pdf")
    pdf_caderninho = caminho_xml.with_name(f"{caminho_xml.stem}_CADERNINHO.pdf")
    mid_final = caminho_xml.with_name(f"{caminho_xml.stem}.mid")
    
    # 1. Gerar PDF Normal
    cmd_pdf = [executavel_musescore, str(caminho_xml), "-o", str(pdf_final)]
    subprocess.run(cmd_pdf, capture_output=True, text=True, encoding='utf-8', errors='replace')
    
    # 2. Gerar PDF Caderninho (A5 Paisagem)
    caminho_estilo = criar_estilo_a5(pasta_saida)
    cmd_caderninho = [executavel_musescore, str(caminho_xml), "-S", str(caminho_estilo), "-o", str(pdf_caderninho)]
    subprocess.run(cmd_caderninho, capture_output=True, text=True, encoding='utf-8', errors='replace')
    
    # 3. Tentar gerar MIDI
    try:
        cmd_mid = [executavel_musescore, str(caminho_xml), "-o", str(mid_final)]
        subprocess.run(cmd_mid, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if mid_final.exists():
            print(f"  -> MIDI exportado com sucesso.")
        else:
            print(f"  -> Aviso: Falha ao exportar MIDI (ignorado).")
    except Exception as e:
        print(f"  -> Aviso: Exceção ao exportar MIDI: {e}")

    if pdf_final.exists():
        return pdf_final
    else:
        print(f"Erro Crítico no MuseScore ao processar {caminho_xml.name}.")
        return None

def processar_pasta(pasta_entrada, instrumento, cmd_audiveris, cmd_musescore):
    pasta = Path(pasta_entrada)
    if not pasta.exists():
        print(f"Pasta {pasta} não encontrada. Pulando...")
        return
        
    extensoes_suportadas = ["*.pdf", "*.png", "*.jpg", "*.jpeg"]
    arquivos = []
    for ext in extensoes_suportadas:
        # Pega apenas arquivos na raiz da pasta (ignora os que já foram movidos para subpastas)
        arquivos.extend([f for f in pasta.glob(ext) if f.is_file()])

    if not arquivos:
        print(f"Nenhum arquivo novo encontrado na pasta de {instrumento}.")
        return

    print(f"\n==== INICIANDO PROCESSAMENTO: {instrumento.upper()} ====")
    for arquivo in arquivos:
        if "_FINAL" in arquivo.name or "_CADERNINHO" in arquivo.name: 
            continue
            
        print(f"\n--- Processando: {arquivo.name} ---")
        
        # Cria a pasta isolada para a música e move o arquivo original para lá
        pasta_musica = pasta / arquivo.stem
        pasta_musica.mkdir(exist_ok=True)
        
        caminho_original_movido = pasta_musica / arquivo.name
        shutil.move(str(arquivo), str(caminho_original_movido))
        
        # Etapa 1: OMR
        mxl_originais = executar_audiveris(caminho_original_movido, pasta_musica, cmd_audiveris)
        if not mxl_originais: 
            continue
        
        for mxl_original in mxl_originais:
            print(f"  -> Processando movimento: {mxl_original.name}")
            
            arquivo_para_anotar = mxl_original
            
            # Se a opção for "Criar Baixos", interceptamos o XML gerado e criamos a linha de baixo
            if instrumento == "Criar Baixos":
                xml_baixo = gerar_baixo(mxl_original)
                if xml_baixo:
                    arquivo_para_anotar = xml_baixo
                    instrumento_anotacao = "Tuba" # Força o dedilhado de Tuba para o baixo gerado
                else:
                    continue
            else:
                instrumento_anotacao = instrumento

            # Etapa 2: Dedilhado / Notas
            xml_editado = aplicar_dedilhado(arquivo_para_anotar, instrumento_anotacao)
            if not xml_editado: 
                print(f"Erro ao aplicar anotações para {arquivo_para_anotar.name}.")
                continue
            
            # Etapa 3: Renderização (PDFs e MIDI)
            pdf_final = executar_musescore(xml_editado, cmd_musescore, pasta_musica)
            if pdf_final:
                print(f"SUCESSO: Arquivos gerados na pasta {pasta_musica.name}/")

if __name__ == "__main__":
    AUDIVERIS_CMD = r"C:\Program Files\Audiveris\Audiveris.exe" 
    MUSESCORE_CMD = r"C:\Program Files\MuseScore 4\bin\MuseScore4.exe"

    instrumentos = ["Tuba", "Trombone", "Trompete", "Bombardino", "Apenas Notas", "Criar Baixos"]
    pastas_alvo = {}

    print("--- Configuração do Pipeline de Partituras ---")
    print("Digite o caminho completo da pasta para cada instrumento. Digite 'X' para ignorar.")
    
    for inst in instrumentos:
        caminho = input(f"Pasta para {inst}: ").strip().replace('"', '').replace("'", "")
        
        if caminho.upper() != 'X' and caminho != '':
            pastas_alvo[inst] = caminho

    if not pastas_alvo:
        print("Nenhuma pasta configurada. Encerrando.")
    else:
        for inst, caminho_pasta in pastas_alvo.items():
            print(f"\nIniciando processamento para {inst}...")
            processar_pasta(caminho_pasta, inst, AUDIVERIS_CMD, MUSESCORE_CMD)
        print("\nPipeline concluído com sucesso.")