import os
import subprocess
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

def executar_audiveris(caminho_pdf, pasta_saida, executavel_audiveris):
    """Executa o Audiveris em modo headless para converter PDF em MXL."""
    print(f"[{caminho_pdf.name}] Iniciando OMR via Audiveris...")
    comando = [
        executavel_audiveris,
        "-batch",
        "-export",
        "-output", str(pasta_saida),
        str(caminho_pdf)
    ]
    
    subprocess.run(comando, capture_output=True, text=True, encoding='utf-8', errors='replace')
    
    mxl_gerados = list(pasta_saida.glob(f"{caminho_pdf.stem}*.mxl"))
    
    # Atualizado para ignorar tanto arquivos de pistos quanto os de apenas notas
    mxl_gerados = [f for f in mxl_gerados if "_pistos" not in f.name and "_notas" not in f.name]
    
    if mxl_gerados:
        return mxl_gerados
    else:
        print(f"Erro Crítico: O Audiveris falhou e não gerou arquivos .mxl para {caminho_pdf.name}.")
        return []

def aplicar_dedilhado(caminho_mxl, instrumento):
    print(f"[{caminho_mxl.name}] Aplicando anotações para {instrumento}...")
    
    # Usamos .get() para evitar KeyError caso o instrumento seja "Apenas Notas"
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
                # A nota sempre recebe o nome em português (lyricNumber=1)
                nome_nota_pt = obter_nome_pt(nota.pitch)
                nota.addLyric(nome_nota_pt, lyricNumber=1)
                
                # O dedilhado (lyricNumber=2) só é adicionado se houver um mapa válido
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
                    break # Adiciona apenas para a nota principal do acorde

        # Define o sufixo correto baseado na escolha do usuário
        sufixo = "_notas" if instrumento == "Apenas Notas" else "_pistos"
        mxl_editado = caminho_mxl.with_name(f"{caminho_mxl.stem}{sufixo}.mxl")
        
        score.write('musicxml', fp=str(mxl_editado))
        return mxl_editado
    except Exception as e:
        print(f"Erro ao processar XML: {e}")
        return None

def executar_musescore(caminho_mxl, executavel_musescore):
    """Renderiza o arquivo MXL para PDF usando o MuseScore."""
    print(f"[{caminho_mxl.name}] Renderizando PDF final via MuseScore...")
    pdf_final = caminho_mxl.with_name(f"{caminho_mxl.stem}_FINAL.pdf")
    
    comando = [
        executavel_musescore,
        str(caminho_mxl),
        "-o", str(pdf_final)
    ]
    
    # Adicionado encoding para evitar quebra na leitura do console do MuseScore
    resultado = subprocess.run(comando, capture_output=True, text=True, encoding='utf-8', errors='replace')
    
    # MuseScore 4 frequentemente retorna exit codes de erro por falhas de driver de áudio em background.
    # A validação correta é verificar se o arquivo PDF foi efetivamente criado no disco.
    if pdf_final.exists():
        return pdf_final
    else:
        print(f"Erro Crítico no MuseScore ao processar {caminho_mxl.name}.")
        print(f"Detalhes (Stdout): {resultado.stdout.strip()}")
        print(f"Detalhes (Stderr): {resultado.stderr.strip()}")
        return None

def processar_pasta(pasta_entrada, instrumento, cmd_audiveris, cmd_musescore):
    pasta = Path(pasta_entrada)
    if not pasta.exists():
        print(f"Pasta {pasta} não encontrada. Pulando...")
        return
        
    extensoes_suportadas = ["*.pdf", "*.png", "*.jpg", "*.jpeg"]
    arquivos = []
    for ext in extensoes_suportadas:
        arquivos.extend(pasta.glob(ext))

    if not arquivos:
        print(f"Nenhum PDF ou imagem encontrado na pasta de {instrumento}.")
        return

    print(f"\n==== INICIANDO PROCESSAMENTO: {instrumento.upper()} ====")
    for arquivo in arquivos:
        if "_FINAL" in arquivo.name: 
            print(f"[{arquivo.name}] Ignorado (já processado).")
            continue
            
        print(f"\n--- Processando: {arquivo.name} ---")
        
        # Etapa 1: OMR (Agora retorna uma lista de arquivos)
        mxl_originais = executar_audiveris(arquivo, pasta, cmd_audiveris)
        if not mxl_originais: 
            continue
        
        # Itera sobre cada movimento/partitura gerada pelo Audiveris
        for mxl_original in mxl_originais:
            print(f"  -> Aplicando dedilhado no movimento: {mxl_original.name}")
            
            # Etapa 2: Dedilhado
            mxl_editado = aplicar_dedilhado(mxl_original, instrumento)
            if not mxl_editado: 
                print(f"Erro ao aplicar dedilhados para {mxl_original.name}.")
                continue
            
            # Etapa 3: Renderização
            pdf_final = executar_musescore(mxl_editado, cmd_musescore)
            if pdf_final:
                print(f"SUCESSO: {pdf_final.name} gerado.")
                

if __name__ == "__main__":
    AUDIVERIS_CMD = r"C:\Program Files\Audiveris\Audiveris.exe" 
    MUSESCORE_CMD = r"C:\Program Files\MuseScore 4\bin\MuseScore4.exe"

    # Adicionada a nova opção "Apenas Notas"
    instrumentos = ["Tuba", "Trombone", "Trompete", "Bombardino", "Apenas Notas"]
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