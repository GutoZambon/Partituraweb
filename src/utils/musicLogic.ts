import JSZip from 'jszip';
import { InstrumentType, ProcessingOptions } from '../types/music';

// Piston / Slide Position Maps
// Key = MIDI note - 18
export const MAPA_TROMPETE: Record<number, string> = {
  34: "1-2-3", 35: "1-3", 36: "2-3", 37: "1-2", 38: "1", 39: "2", 40: "0",
  41: "1-2-3", 42: "1-3", 43: "2-3", 44: "1-2", 45: "1", 46: "2", 47: "0",
  48: "2-3", 49: "1-2", 50: "1", 51: "2", 52: "0", 53: "1-2", 54: "1",
  55: "2", 56: "0", 57: "1", 58: "2", 59: "0", 60: "2-3", 61: "1-2",
  62: "1", 63: "2", 64: "0", 65: "2", 66: "1"
};

export const MAPA_TROMBONE: Record<number, string> = {
  23: "6", 24: "5", 25: "4", 26: "3", 27: "2", 28: "1", 29: "7", 30: "6",
  31: "5", 32: "4", 33: "3", 34: "2", 35: "1", 36: "5", 37: "4", 38: "3",
  39: "2", 40: "1", 41: "4", 42: "3", 43: "2", 44: "1", 45: "3", 46: "2",
  47: "1", 48: "3", 49: "2", 50: "3", 51: "1"
};

export const MAPA_TUBA: Record<number, string> = {
  10: "1-2-3", 11: "1-3", 12: "2-3", 13: "1-2", 14: "1", 15: "2", 16: "0",
  17: "1-2-3", 18: "1-3", 19: "2-3", 20: "1-2", 21: "1", 22: "2", 23: "0",
  24: "2-3", 25: "1-2", 26: "1", 27: "2", 28: "0", 29: "1-2", 30: "1",
  31: "2", 32: "0", 33: "1", 34: "2", 35: "0", 36: "2-3", 37: "1-2",
  38: "1", 39: "2", 40: "0", 41: "2", 42: "1"
};

export const MAPA_BOMBARDINO: Record<number, string> = {
  17: "1-2-3-4", 18: "1-3-4", 19: "2-3-4", 20: "1-2-4", 21: "1-4",
  22: "1-2-3", 23: "1-3", 24: "2-3", 25: "1-2", 26: "1", 27: "2",
  28: "0", 29: "1-2-3", 30: "1-3", 31: "2-3", 32: "1-2", 33: "1",
  34: "2", 35: "0", 36: "2-3", 37: "1-2", 38: "1", 39: "2", 40: "0",
  41: "1-2", 42: "1", 43: "2", 44: "0", 45: "1", 46: "2", 47: "0",
  48: "2-3", 49: "1-2", 50: "1", 51: "2", 52: "0", 53: "2", 54: "1"
};

export const MAPEAMENTOS: Record<string, Record<number, string>> = {
  "Trompete": MAPA_TROMPETE,
  "Trombone": MAPA_TROMBONE,
  "Tuba": MAPA_TUBA,
  "Bombardino": MAPA_BOMBARDINO
};

export const MAPA_NOTAS_PT: Record<string, string> = {
  'C': 'Dó',
  'D': 'Ré',
  'E': 'Mi',
  'F': 'Fá',
  'G': 'Sol',
  'A': 'Lá',
  'B': 'Si'
};

// Key Signature Fifths lookup
const FIFTHS_TO_KEY_MAJOR: Record<number, string> = {
  0: 'Dó Maior',
  1: 'Sol Maior',
  2: 'Ré Maior',
  3: 'Lá Maior',
  4: 'Mi Maior',
  5: 'Si Maior',
  6: 'Fá# Maior',
  7: 'Dó# Maior',
  '-1': 'Fá Maior',
  '-2': 'Si♭ Maior',
  '-3': 'Mi♭ Maior',
  '-4': 'Lá♭ Maior',
  '-5': 'Ré♭ Maior',
  '-6': 'Sol♭ Maior',
  '-7': 'Dó♭ Maior'
};

const FIFTHS_TO_KEY_MINOR: Record<number, string> = {
  0: 'Lá menor',
  1: 'Mi menor',
  2: 'Si menor',
  3: 'Fá# menor',
  4: 'Dó# menor',
  5: 'Sol# menor',
  6: 'Ré# menor',
  7: 'Lá# menor',
  '-1': 'Ré menor',
  '-2': 'Sol menor',
  '-3': 'Dó menor',
  '-4': 'Fá menor',
  '-5': 'Si♭ menor',
  '-6': 'Mi♭ menor',
  '-7': 'Lá♭ menor'
};

/**
 * Calculates MIDI pitch number from pitch elements
 */
export function getMidiFromPitch(step: string, octave: number, alter: number = 0): number {
  const stepOffsets: Record<string, number> = {
    'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11
  };
  const base = stepOffsets[step.toUpperCase()] ?? 0;
  return (octave + 1) * 12 + base + alter;
}

/**
 * Converts pitch step and accidental into Portuguese note name
 */
export function getNomeNotaPt(step: string, alter: number = 0): string {
  let nome = MAPA_NOTAS_PT[step.toUpperCase()] || step;
  if (alter === 1) {
    nome += '#';
  } else if (alter === -1) {
    nome += 'b';
  } else if (alter === 2) {
    nome += '##';
  } else if (alter === -2) {
    nome += 'bb';
  }
  return nome;
}

/**
 * Analyzes MusicXML document to determine key signature (Tom da música)
 */
export function detectKeySignature(xmlDoc: Document): { keyName: string; fifths: number; mode: string } {
  const fifthsElem = xmlDoc.querySelector('key > fifths');
  const modeElem = xmlDoc.querySelector('key > mode');
  
  const fifths = fifthsElem ? parseInt(fifthsElem.textContent?.trim() || '0', 10) : 0;
  let mode = modeElem?.textContent?.trim().toLowerCase() || 'major';
  
  // If mode not specified, analyze last measure's notes to check whether root is minor or major
  if (!modeElem) {
    const notes = xmlDoc.querySelectorAll('measure:last-of-type note pitch');
    if (notes.length > 0) {
      const lastNote = notes[notes.length - 1];
      const step = lastNote.querySelector('step')?.textContent?.trim().toUpperCase();
      // Tonic comparison for minor relative
      if (fifths === 0 && step === 'A') mode = 'minor';
      else if (fifths === 1 && step === 'E') mode = 'minor';
      else if (fifths === 2 && step === 'B') mode = 'minor';
      else if (fifths === -1 && step === 'D') mode = 'minor';
      else if (fifths === -2 && step === 'G') mode = 'minor';
      else if (fifths === -3 && step === 'C') mode = 'minor';
    }
  }

  const keyName = mode === 'minor'
    ? (FIFTHS_TO_KEY_MINOR[fifths] || `${fifths} acidentes (menor)`)
    : (FIFTHS_TO_KEY_MAJOR[fifths] || `${fifths} acidentes`);

  return { keyName, fifths, mode };
}

/**
 * Unzips MXL file if needed and returns MusicXML string
 */
export async function extractMusicXml(bufferOrString: ArrayBuffer | string): Promise<string> {
  if (typeof bufferOrString === 'string') {
    if (bufferOrString.trim().startsWith('<') || bufferOrString.includes('<score-partwise')) {
      return bufferOrString;
    }
  }

  try {
    const zip = await JSZip.loadAsync(bufferOrString);
    // Find container.xml or any .xml file
    const container = zip.file('META-INF/container.xml');
    let xmlFileName = '';
    if (container) {
      const containerText = await container.async('text');
      const match = containerText.match(/full-path="([^"]+)"/);
      if (match && match[1]) {
        xmlFileName = match[1];
      }
    }

    if (xmlFileName && zip.file(xmlFileName)) {
      return await zip.file(xmlFileName)!.async('text');
    }

    // Fallback: look for first .xml file in zip
    for (const [name, file] of Object.entries(zip.files)) {
      if (name.endsWith('.xml') && !name.includes('META-INF') && !file.dir) {
        return await file.async('text');
      }
    }
  } catch {
    // Not a zip, return string if possible
    if (typeof bufferOrString !== 'string') {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bufferOrString);
    }
  }

  return typeof bufferOrString === 'string' ? bufferOrString : '';
}

/**
 * Processes a MusicXML document according to user options
 */
export function processMusicXml(
  rawXml: string,
  instrument: InstrumentType,
  options: ProcessingOptions
): { processedXml: string; detectedKey: string; title: string } {
  if (!rawXml || !rawXml.trim()) {
    throw new Error('O conteúdo da partitura está vazio ou não pôde ser lido.');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rawXml, 'application/xml');

  // Check for parse error
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Falha ao analisar o arquivo MusicXML: ' + parserError.textContent);
  }

  // 1. Detect Title
  const workTitleElem = xmlDoc.querySelector('work > work-title') || xmlDoc.querySelector('movement-title');
  const title = workTitleElem?.textContent?.trim() || 'Partitura';

  // 2. Detect Key Signature (TOM da música)
  const keyInfo = detectKeySignature(xmlDoc);
  const detectedKey = keyInfo.keyName;

  // 3. Insert TOM at the top of the first measure
  if (options.addKeyHeader) {
    const firstMeasure = xmlDoc.querySelector('measure');
    if (firstMeasure) {
      // Check if direction with Tom already exists
      const existingDirections = firstMeasure.querySelectorAll('direction words');
      let alreadyHasTom = false;
      existingDirections.forEach(el => {
        if (el.textContent && el.textContent.includes('Tom:')) alreadyHasTom = true;
      });

      if (!alreadyHasTom) {
        const direction = xmlDoc.createElement('direction');
        direction.setAttribute('placement', 'above');
        
        const directionType = xmlDoc.createElement('direction-type');
        const words = xmlDoc.createElement('words');
        words.setAttribute('font-weight', 'bold');
        words.setAttribute('font-size', '11');
        words.textContent = `Tom: ${detectedKey}`;
        
        directionType.appendChild(words);
        direction.appendChild(directionType);
        
        // Insert at beginning of measure
        firstMeasure.insertBefore(direction, firstMeasure.firstChild);
      }
    }
  }

  // 4. Clave transposition for Bombardino / Trombone in Treble Clef
  if (options.transposeSolToFa && (instrument === 'Bombardino' || instrument === 'Trombone')) {
    const clefs = xmlDoc.querySelectorAll('clef');
    let hasTrebleClef = false;
    clefs.forEach(c => {
      const sign = c.querySelector('sign')?.textContent?.trim();
      if (sign === 'G') hasTrebleClef = true;
    });

    if (hasTrebleClef) {
      // Transpose pitches down by Major Ninth (-14 semitones)
      // Step transposition: -1 diatonic step down, -1 octave, alter adjustments
      transposePitchesDownM9(xmlDoc);

      // Change G clef to F clef (Bass Clef)
      clefs.forEach(c => {
        const sign = c.querySelector('sign');
        const line = c.querySelector('line');
        if (sign && sign.textContent?.trim() === 'G') {
          sign.textContent = 'F';
          if (line) line.textContent = '4';
        }
      });
    }
  }

  // 5. Apply Note Names and Fingerings / Positions
  const mapaInstrumento = instrument !== 'Apenas Notas' ? MAPEAMENTOS[instrument] : null;

  const notes = xmlDoc.querySelectorAll('note');
  notes.forEach(note => {
    // Skip rests and grace notes
    if (note.querySelector('rest')) return;
    
    // Check if chord (only first note of chord or handle properly)
    const isChord = note.querySelector('chord') !== null;
    if (isChord) {
      // Often chord tones in brass are unison or double, but annotate first or all
    }

    const pitch = note.querySelector('pitch');
    if (!pitch) return;

    const step = pitch.querySelector('step')?.textContent?.trim() || 'C';
    const octave = parseInt(pitch.querySelector('octave')?.textContent?.trim() || '4', 10);
    const alter = parseInt(pitch.querySelector('alter')?.textContent?.trim() || '0', 10);

    const midi = getMidiFromPitch(step, octave, alter);
    const nomeNotaPt = getNomeNotaPt(step, alter);

    // Remove existing lyrics if we are replacing them
    const existingLyrics = note.querySelectorAll('lyric');
    existingLyrics.forEach(l => l.remove());

    // Lyric 1: Note name in Portuguese
    if (options.addNoteNames) {
      const lyric1 = xmlDoc.createElement('lyric');
      lyric1.setAttribute('number', '1');
      lyric1.setAttribute('name', 'note_name');
      
      const text1 = xmlDoc.createElement('text');
      text1.textContent = nomeNotaPt;
      lyric1.appendChild(text1);
      note.appendChild(lyric1);
    }

    // Lyric 2: Valve / Slide position
    if (options.addFingerings && mapaInstrumento) {
      const chaveQml = midi - 18;
      const dedilhado = mapaInstrumento[chaveQml];
      if (dedilhado) {
        const lyric2 = xmlDoc.createElement('lyric');
        lyric2.setAttribute('number', '2');
        lyric2.setAttribute('name', 'fingering');
        
        const text2 = xmlDoc.createElement('text');
        text2.textContent = dedilhado;
        lyric2.appendChild(text2);
        note.appendChild(lyric2);
      }
    }
  });

  const serializer = new XMLSerializer();
  const processedXml = serializer.serializeToString(xmlDoc);

  return { processedXml, detectedKey, title };
}

/**
 * Transposes pitches down a Major Ninth (-14 semitones)
 */
function transposePitchesDownM9(xmlDoc: Document) {
  const diatonicSteps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const stepSemis = [0, 2, 4, 5, 7, 9, 11];

  const notes = xmlDoc.querySelectorAll('note pitch');
  notes.forEach(pitch => {
    const stepElem = pitch.querySelector('step');
    const octaveElem = pitch.querySelector('octave');
    const alterElem = pitch.querySelector('alter');

    if (!stepElem || !octaveElem) return;

    const step = stepElem.textContent?.trim().toUpperCase() || 'C';
    let octave = parseInt(octaveElem.textContent?.trim() || '4', 10);
    let alter = alterElem ? parseInt(alterElem.textContent?.trim() || '0', 10) : 0;

    const currentMidi = getMidiFromPitch(step, octave, alter);
    const targetMidi = currentMidi - 14;

    // Transpose diatonically: 1 step down + 1 octave down
    let stepIndex = diatonicSteps.indexOf(step);
    stepIndex -= 1; // 1 diatonic step down (Major 2nd down)
    if (stepIndex < 0) {
      stepIndex += 7;
      octave -= 1;
    }
    octave -= 1; // octave down for the 9th

    const newStep = diatonicSteps[stepIndex];
    const naturalMidi = (octave + 1) * 12 + stepSemis[stepIndex];
    alter = targetMidi - naturalMidi;

    stepElem.textContent = newStep;
    octaveElem.textContent = octave.toString();

    if (alter !== 0) {
      if (!alterElem) {
        const newAlter = xmlDoc.createElement('alter');
        newAlter.textContent = alter.toString();
        pitch.appendChild(newAlter);
      } else {
        alterElem.textContent = alter.toString();
      }
    } else if (alterElem) {
      alterElem.remove();
    }
  });
}
