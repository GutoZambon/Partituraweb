# Processador Automático de Partituras (OMR & Dedilhado)

## Visão Geral
Este script automatiza o processo de conversão, transposição e anotação de partituras (PDFs ou Imagens) para instrumentos de metais (Tuba, Bombardino, Trombone e Trompete). 

O pipeline executa três etapas principais:
1. **Reconhecimento Ótico (OMR):** Usa o software Audiveris para "ler" a imagem/PDF e gerar um arquivo MusicXML (semântico).
2. **Processamento Musical (Python/music21):** Lê o XML, transpõe a partitura (ex: Clave de Sol para Fá, se aplicável a Bombardino/Trombone), adiciona o nome da nota em português e o dedilhado/posição correspondente.
3. **Renderização Final:** Usa o software MuseScore 4 via linha de comando para converter o XML anotado de volta em um PDF pronto para impressão.

---

## 1. Pré-requisitos e Instalação de Softwares

O script não funciona sozinho. Ele exige que os seguintes programas estejam instalados na sua máquina:

### A. Java (Necessário para o Audiveris)
O Audiveris é escrito em Java. Você precisa do **Java JRE ou JDK (versão 11 ou superior)**.
- Baixe e instale: [Oracle Java](https://www.oracle.com/java/technologies/downloads/) ou [Adoptium/Eclipse Temurin](https://adoptium.net/).

### B. Audiveris (Motor OMR)
Responsável por ler os PDFs e imagens.
- Baixe a versão compilada mais recente no GitHub oficial do projeto: [Audiveris Releases](https://github.com/Audiveris/audiveris/releases).
- Descompacte/instale em uma pasta fixa (ex: `C:\Program Files\Audiveris`).
- *Nota: O Audiveris utiliza o Tesseract OCR para ler textos (títulos). É recomendável abrir o programa manualmente pelo menos uma vez após a instalação para garantir que ele baixe os pacotes de idioma necessários.*

### C. MuseScore 4
Responsável por desenhar a partitura final em PDF.
- Baixe e instale: [MuseScore](https://musescore.org/pt-br).
- Anote a pasta onde o programa foi instalado (geralmente `C:\Program Files\MuseScore 4`).

### D. Python e Dependências
Se for executar o script diretamente (sem o executável compilado):
- Instale o Python 3.9+.
- No terminal, instale a biblioteca de processamento musical:
  `pip install music21`

---

## 2. Configuração do Script (Importante)

Como os computadores instalam os programas em locais diferentes, **você deve informar ao script onde o Audiveris e o MuseScore estão**.

Abra o arquivo `partituras.py` em um editor de texto e vá até o final do arquivo, no bloco `if __name__ == "__main__":`. Atualize as variáveis `AUDIVERIS_CMD` e `MUSESCORE_CMD` com o **caminho absoluto** dos executáveis na sua máquina:

```python
if __name__ == "__main__":
    # Caminhos executáveis (ATENÇÃO: Atualize conforme a sua máquina)
    # Mantenha o 'r' antes das aspas no Windows.
    
    # Caminho para o executável (ou .bat) do Audiveris
    AUDIVERIS_CMD = r"C:\Program Files\Audiveris\Audiveris.exe" 
    
    # Caminho para o executável do MuseScore 4
    MUSESCORE_CMD = r"C:\Program Files\MuseScore 4\bin\MuseScore4.exe"
    
    # ... resto do código ...