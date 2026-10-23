# Processador Web de Partituras para Metais (PartiturasWeb)

Aplicação web completa, responsiva e gratuita para conversão, anotação de pistos/notas, detecção de tom, reordenação e diagramação de partituras (A4 Normal, Caderninho A5 2-em-1 empilhado em folha A4 e formato Kindle Scribe 10'' Paisagem) com pré-visualização interativa e remoção de páginas em branco.

---

> [!IMPORTANT]
> **Decisões Confirmadas com o Usuário:**
> - **Formatos de Entrada:** Suporte completo a PDFs escaneados, fotos/imagens de partituras (`.png`, `.jpg`, `.jpeg`), além de partituras semânticas MusicXML (`.xml`, `.mxl`).
> - **Exibição do Tom da Música:** Inserido de forma destacada como texto informativo no topo do primeiro compasso da partitura (ex: `Tom: Dó Maior`, `Tom: Fá Maior`, `Tom: Si♭ Maior`), calculando e corrigindo a armadura de clave (*Key Signature*).
> - **Caderninho A5:** Formatação de 2 páginas A5 paisagem empilhadas verticalmente por folha A4 retrato (210 × 297 mm), com linha sutil de corte central para facilitar montagem de pastas e cadernos de marcha.
> - **Kindle 10 Polegadas:** Diagramação otimizada no formato paisagem proporção 16:10 (Kindle Scribe), com margens calibradas e alto contraste para e-readers de tinta eletrônica.
> - **Remoção de Linha de Baixos:** A rotina antiga de geração sintética de baixos a partir de trombones foi removida conforme solicitado.
> - **Sem Autenticação ou Custos:** Acesso público instantâneo, sem necessidade de login, tokens ou pagamentos.

---

## 1. Visão Geral & Arquitetura de Execução Web

### Desafio da Hospedagem Gratuita & Dependências MuseScore/Audiveris
Em ambientes de nuvem gratuitos (ou serverless/Cloud Run sem custos), instalar o desktop GUI do MuseScore 4 e Audiveris com Java JDK é inviável por consumo de memória (>3GB RAM), dependências de display X11/Qt e latência de inicialização. 

**Solução Arquitetural:**
1. **Pipeline de Partituras Serverless & Web-Native:**
   - **Módulo de OMR & Transcrição Inteligente Multimodal:** Para PDFs escaneados e imagens, o backend Express utiliza o modelo `gemini-4-argon` com `thinkingLevel: ThinkingLevel.HIGH` para reconhecer notas, claves, armaduras e compassos, gerando MusicXML estruturado de alta fidelidade.
   - **Módulo de MusicXML Direto:** Suporte imediato e ultra-rápido para arquivos MusicXML (`.xml` e `.mxl` compactados via JSZip).
   - **Módulo de Anotação Musical e Transposição:** Motor em TypeScript reproduzindo com precisão as tabelas de dedilhado (Trompete, Trombone posições de vara 1–7, Tuba, Bombardino) e transposição automática de Clave de Sol para Clave de Fá (-9M) para Trombone/Bombardino.
   - **Motor de Renderização Vetorial de Partituras:** Baseado em renderizadores web sem necessidade de binários C++ pesados, gerando páginas nítidas em SVG/Canvas.
   - **Motor de Composição PDF (pdf-lib):**
     - Remoção inteligente de páginas em branco (análise de ocupação de elementos gráficos).
     - Layout Caderninho: Composição de 2 páginas por folha A4 retrato (empilhadas 210 × 148.5 mm cada).
     - Layout Kindle 10'': Canvas paisagem 16:10 ajustado para leitura nítida em telas e-ink.
     - Layout Normal: A4 em alta resolução.
     - Unificação com ordenação personalizada por instrumento (grade/score order).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND (React SPA)                             │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ 1. Seleção de Funções │  │ 2. Upload / Dropzone  │  │ 3. Ordenação de │  │
│  │    & Instrumentos     │  │  (PDF, Imagem, XML)   │  │   Instrumentos  │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └────────┬────────┘  │
│              │                          │                       │           │
│              ▼                          ▼                       ▼           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │          Pré-Visualizador Interativo (SVG / Canvas / Páginas)         │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │    Central de Exportação: Download Individual / Caderninho / Kindle   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Express Proxy)                           │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ Transcrição OMR IA    │  │ Motor de Anotação &   │  │ Formatador PDF  │  │
│  │ (gemini-4-argon)      │  │ Transposição (-M9)    │  │ (pdf-lib)       │  │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Experiência do Usuário (UX) & Design Visual

Seguindo os princípios de design minimalista, alta densidade e tipografia refinada:
- **Tema Visual:** Minimalismo utilitário e tipográfico inspirado em estúdios de edição e tipografia musical clássica (fundo neutro claro `#FAFAF9`, superfícies em branco puro `#FFFFFF`, detalhes em grafite escuro `#1C1917` e destaque sutil azul índigo `#4338CA`).
- **Fontes:** `Plus Jakarta Sans` para interface e cabeçalhos, emparelhado com `JetBrains Mono` / `tabular-nums` para compassos, paginações e detalhes técnicos.
- **Fluxo do Usuário:**
  1. **Configuração de Recursos:** O usuário marca as opções desejadas:
     - Anotações: *Posições de Pisto / Vara*, *Apenas Nomes das Notas (Dó, Ré, Mi...)* ou *Partitura Limpa*.
     - Transposição: *Automática para Clave de Fá (-9M)* para Bombardino/Trombone em Clave de Sol.
     - Adição do Tom: *Ativar texto informativo no topo do primeiro compasso*.
     - Formato de Saída: *Normal A4*, *Caderninho A5 (2 por folha A4 retrato)* e/ou *Kindle 10'' Paisagem*.
     - *Eliminar páginas em branco automaticamente*.
  2. **Envio de Arquivos:** Arraste e solte de múltiplos arquivos de partituras (PDFs escaneados, fotos de câmera/celular, ou arquivos MusicXML).
  3. **Reordenação e Atribuição de Instrumentos:** Lista interativa tipo gaveta/cards onde o músico define o instrumento de cada arquivo (Trompete, Trombone, Tuba, Bombardino) e arrasta para definir a ordem exata de impressão das páginas.
  4. **Pré-Visualização em Tempo Real:** Visualização página a página com alternância de zoom, verificação das notas e dedilhados antes de baixar.
  5. **Exportação com 1 Clique:** Baixar arquivo unificado pronto para impressão ou arquivos individuais em `.zip`.

---

## 3. Correção e Cálculo do TOM da Música

No código anterior em Python, a armadura não estava sendo convertida em texto compreensível nem injetada graficamente. O novo algoritmo:
1. **Leitura da Armadura (Key Signature):** Extrai o número de acidentes (*fifths* de -7 a +7) e o modo (maior/menor).
   - 0 = Dó Maior (ou Lá menor)
   - 1 = Sol Maior (ou Mi menor)
   - 2 = Ré Maior (ou Si menor)
   - 3 = Lá Maior (ou Fá# menor)
   - -1 = Fá Maior (ou Ré menor)
   - -2 = Si♭ Maior (ou Sol menor)
   - -3 = Mi♭ Maior (ou Dó menor)
   - etc.
2. **Análise Harmônica de Fechamento:** Avalia as notas de início e fim da partitura para desambiguar entre o tom relativo menor e o maior.
3. **Injeção no Primeiro Compasso:** Cria um elemento de texto formal `<direction><direction-type><words font-weight="bold" font-size="12">Tom: [Nome]</words></direction-type><offset>-10</offset></direction>` logo no compasso 1, garantindo que apareça no topo da partitura impresso.

---

## 4. Remoção de Páginas em Branco e Diagramação

- **Algoritmo Anti-Página em Branco:** Inspeciona o fluxo de nós e dimensões renderizadas; se uma página secundária tiver apenas pausas finais ou vazios estruturais sem notas executáveis, ela é descartada antes da junção no PDF.
- **Caderninho A5 2-em-1 (Folha A4 Retrato):**
  - Folha A4 Retrato: 210mm de largura × 297mm de altura.
  - Metade Superior: Página A5 Paisagem (210mm × 148.5mm).
  - Metade Inferior: Página A5 Paisagem seguinte (210mm × 148.5mm).
  - Linha tracejada de corte suave ao centro (Y = 148.5mm) com margem de segurança de sangria.
- **Kindle Scribe 10'' Paisagem:**
  - Resolução orientada para tela 16:10 (proporção 2480 × 1550 pts), alto contraste preto e branco, ampliando as pautas musicais para preencher o campo visual e evitar cansaço na estante musical.

---

## 5. Próximos Passos na Execução

1. Configuração dos pacotes no frontend (`pdf-lib`, `lucide-react`, renderizador musical, utilitários de compressão).
2. Construção do motor de anotação e tabelas de dedilhado com correção de Tom.
3. Integração do backend para processamento multimodal inteligente com Gemini para PDFs/fotos de partitura escaneadas.
4. Construção da interface minimalista com fluxo de configuração, upload, reordenação de instrumentos e pré-visualizador.
5. Verificação e compilação do build final.
