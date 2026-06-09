// Up塾 YouTubeスライド生成アプリ
// 役割: 台本の段落分割、スライド分解テキスト解析、編集可能なスライドHTML生成、JSON保存・読み込み、PNG出力を担当します。

const scriptInput = document.getElementById('scriptInput');
const slideBreakdownInput = document.getElementById('slideBreakdownInput');
const imageInput = document.getElementById('imageInput');
const generateButton = document.getElementById('generateButton');
const generateFromBreakdownButton = document.getElementById('generateFromBreakdownButton');
const saveJsonButton = document.getElementById('saveJsonButton');
const loadJsonButton = document.getElementById('loadJsonButton');
const loadJsonInput = document.getElementById('loadJsonInput');
const downloadAllButton = document.getElementById('downloadAllButton');
const slidesContainer = document.getElementById('slidesContainer');
const slideCountText = document.getElementById('slideCountText');

const APP_VERSION = '1.4.0';
const PROJECT_FORMAT = 'upjuku-slide-project';
const SUPPORTED_PROJECT_SCHEMA_VERSION = 1;
const VALID_SLIDE_TYPES = ['title', 'explanation', 'imageExplanation', 'diagramExplanation'];

let uploadedImageDataUrls = [];
let currentSlideDataList = [];

const sampleScript = `一次関数のグラフを読み取ろう

今日は、一次関数のグラフから傾きと切片を見つける練習をします。まずはグラフが右上がりか右下がりかに注目しましょう。

傾きは「右に1進んだとき、上にいくつ進むか」で考えると分かりやすいです。点を2つ選び、縦の変化と横の変化を比べます。

切片は、グラフがy軸と交わる場所です。式 y = ax + b の b にあたります。最後に、読み取った傾きと切片を式にまとめましょう。`;

const sampleSlideBreakdown = `--- slide 1
タイトル：一次関数のグラフを読み取ろう
本文：今日は、一次関数のグラフから傾きと切片を見つける練習をします。

--- slide 2
タイトル：まず見る場所
本文：グラフが右上がりか右下がりかに注目します。
図表：一次関数の右上がりグラフ

--- slide 3
タイトル：傾きの考え方
本文：傾きは「右に1進んだとき、上にいくつ進むか」で考えます。
図表：右上がりと右下がりの比較`;

scriptInput.value = sampleScript;
slideBreakdownInput.value = sampleSlideBreakdown;

imageInput.addEventListener('change', async (event) => {
  uploadedImageDataUrls = await readImageFilesAsDataUrls([...event.target.files]);
});

generateButton.addEventListener('click', () => {
  const paragraphs = splitScriptIntoParagraphs(scriptInput.value);

  if (paragraphs.length === 0) {
    showEmptyState('台本を入力してからスライドを生成してください。');
    return;
  }

  currentSlideDataList = createSlideDataList(paragraphs, uploadedImageDataUrls);
  renderSlides(currentSlideDataList);
});

generateFromBreakdownButton.addEventListener('click', () => {
  const slideBreakdownItems = parseSlideBreakdownText(slideBreakdownInput.value);

  if (slideBreakdownItems.length === 0) {
    showEmptyState('スライド分解テキストを入力してから生成してください。');
    return;
  }

  currentSlideDataList = createSlideDataListFromBreakdown(slideBreakdownItems, uploadedImageDataUrls);
  renderSlides(currentSlideDataList);
});

saveJsonButton.addEventListener('click', () => {
  if (currentSlideDataList.length === 0) {
    alert('保存できるスライドがありません。先にスライドを生成するか、JSONを読み込んでください。');
    return;
  }

  downloadProjectJson();
});

loadJsonButton.addEventListener('click', () => {
  loadJsonInput.click();
});

loadJsonInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const projectText = await readFileAsText(file);
    const importedSlides = parseProjectJson(projectText);
    currentSlideDataList = importedSlides;
    normalizeSlideTypes();
    renderSlides(currentSlideDataList);
  } catch (error) {
    alert(`JSON読み込みに失敗しました。\n${error.message}`);
  } finally {
    event.target.value = '';
  }
});

downloadAllButton.addEventListener('click', async () => {
  const slideElements = [...document.querySelectorAll('.slide')];

  for (let index = 0; index < slideElements.length; index += 1) {
    // ブラウザの連続ダウンロード制限を避けるため、少し間隔を空けます。
    await downloadSlideAsPng(slideElements[index], index + 1);
    await wait(350);
  }
});

function splitScriptIntoParagraphs(scriptText) {
  return scriptText
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function parseSlideBreakdownText(inputText) {
  const normalizedText = inputText.replace(/\r\n?/g, '\n').trim();
  if (!normalizedText) return [];

  const blocks = [];
  let currentBlock = null;

  normalizedText.split('\n').forEach((line) => {
    const markerMatch = line.match(/^\s*-{2,}\s*slide\s*(\d+)?\b.*$/i);

    if (markerMatch) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = {
        slideNumber: markerMatch[1] ? Number(markerMatch[1]) : null,
        lines: [],
        originalOrder: blocks.length,
      };
      return;
    }

    if (!currentBlock) {
      currentBlock = {
        slideNumber: null,
        lines: [],
        originalOrder: blocks.length,
      };
    }

    currentBlock.lines.push(line);
  });

  if (currentBlock) blocks.push(currentBlock);

  return blocks
    .map(parseSlideBreakdownBlock)
    .filter((slideItem) => slideItem.title || slideItem.body || slideItem.diagramPrompt)
    .sort(compareSlideBreakdownItems);
}

function parseSlideBreakdownBlock(block) {
  const titleLines = [];
  const bodyLines = [];
  const diagramLines = [];
  const looseLines = [];
  let currentField = null;

  block.lines.forEach((line) => {
    const trimmedLine = line.trim();
    const titleMatch = trimmedLine.match(/^(タイトル|title)\s*[:：]\s*(.*)$/i);
    const bodyMatch = trimmedLine.match(/^(本文|body|text)\s*[:：]\s*(.*)$/i);
    const diagramMatch = trimmedLine.match(/^(図表|diagram)\s*[:：]\s*(.*)$/i);

    if (titleMatch) {
      currentField = 'title';
      if (titleMatch[2]) titleLines.push(titleMatch[2].trim());
      return;
    }

    if (bodyMatch) {
      currentField = 'body';
      if (bodyMatch[2]) bodyLines.push(bodyMatch[2].trim());
      return;
    }

    if (diagramMatch) {
      currentField = 'diagram';
      if (diagramMatch[2]) diagramLines.push(diagramMatch[2].trim());
      return;
    }

    if (!trimmedLine) {
      if (currentField === 'body') bodyLines.push('');
      if (currentField === 'diagram') diagramLines.push('');
      return;
    }

    if (currentField === 'title') {
      titleLines.push(trimmedLine);
    } else if (currentField === 'body') {
      bodyLines.push(trimmedLine);
    } else if (currentField === 'diagram') {
      diagramLines.push(trimmedLine);
    } else {
      looseLines.push(trimmedLine);
    }
  });

  let title = trimMultilineText(titleLines.join('\n'));
  let body = trimMultilineText(bodyLines.join('\n'));
  const diagramPrompt = trimMultilineText(diagramLines.join('\n'));

  if (!title && looseLines.length > 0) {
    title = looseLines.shift();
  }

  if (!body && looseLines.length > 0) {
    body = looseLines.join('\n');
  }

  if (title && !body && titleLines.length > 1) {
    const splitTitleLines = title.split('\n');
    title = splitTitleLines.shift();
    body = splitTitleLines.join('\n');
  }

  return {
    slideNumber: block.slideNumber,
    originalOrder: block.originalOrder,
    title: title || `スライド ${block.slideNumber || block.originalOrder + 1}`,
    body: body || '本文を入力してください。',
    diagramPrompt,
  };
}

function compareSlideBreakdownItems(left, right) {
  const leftHasNumber = Number.isFinite(left.slideNumber);
  const rightHasNumber = Number.isFinite(right.slideNumber);

  if (leftHasNumber && rightHasNumber && left.slideNumber !== right.slideNumber) {
    return left.slideNumber - right.slideNumber;
  }

  if (leftHasNumber !== rightHasNumber) {
    return leftHasNumber ? -1 : 1;
  }

  return left.originalOrder - right.originalOrder;
}

function trimMultilineText(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/^\n+|\n+$/g, '');
}

function createSlideDataList(paragraphs, imageDataUrls) {
  return paragraphs.map((paragraph, index) => {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
    const firstLine = lines[0] || `スライド ${index + 1}`;
    const remainingText = lines.slice(1).join('\n');
    const fallbackBody = index === 0 ? '今回の学習テーマ' : paragraph;
    const imageForSlide = index > 0 ? imageDataUrls[index - 1] : null;

    if (index === 0) {
      return createSlideData('title', firstLine, remainingText || fallbackBody, null);
    }

    return createSlideData(
      imageForSlide ? 'imageExplanation' : 'explanation',
      createSlideTitle(firstLine, index + 1),
      remainingText || paragraph,
      imageForSlide,
    );
  });
}

function createSlideDataListFromBreakdown(breakdownItems, imageDataUrls) {
  return breakdownItems.map((slideItem, index) => {
    const imageForSlide = getImageDataUrlForBreakdownSlide(slideItem, index, imageDataUrls);
    const type = getSlideTypeForContent(index, imageForSlide, slideItem.diagramPrompt);

    return createSlideData(
      type,
      slideItem.title,
      slideItem.body,
      imageForSlide,
      slideItem.diagramPrompt,
    );
  });
}

function getImageDataUrlForBreakdownSlide(slideItem, index, imageDataUrls) {
  if (index === 0 || slideItem.slideNumber === 1) return null;

  const imageIndex = Number.isFinite(slideItem.slideNumber) ? slideItem.slideNumber - 2 : index - 1;
  return imageDataUrls[imageIndex] || null;
}

function createSlideData(type, title, body, imageDataUrl, diagramPrompt = '', createdAt = new Date().toISOString()) {
  return {
    id: createSlideId(),
    type,
    title,
    body,
    imageDataUrl,
    diagramPrompt,
    createdAt,
  };
}

function getSlideTypeForContent(index, imageDataUrl, diagramPrompt) {
  if (imageDataUrl) return 'imageExplanation';
  if (diagramPrompt) return 'diagramExplanation';
  return index === 0 ? 'title' : 'explanation';
}

function createSlideId() {
  return `slide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSlideTitle(firstLine, slideNumber) {
  const shortTitle = firstLine.length > 24 ? `${firstLine.slice(0, 24)}…` : firstLine;
  return shortTitle || `ポイント ${slideNumber - 1}`;
}

function renderSlides(slideDataList) {
  slidesContainer.innerHTML = '';

  if (slideDataList.length === 0) {
    showEmptyState('スライドがありません。');
    return;
  }

  slideDataList.forEach((slideData, index) => {
    const slideCard = document.createElement('article');
    slideCard.className = 'slide-card';
    slideCard.dataset.slideId = slideData.id;

    slideCard.appendChild(createSlideToolbar(slideData, index, slideDataList.length));
    slideCard.appendChild(createSlideEditor(slideData, index));
    slideCard.appendChild(createSlideElement(slideData, index));
    slidesContainer.appendChild(slideCard);
  });

  slideCountText.textContent = `${slideDataList.length}枚のスライドを生成しました。編集後の状態でJSON保存・PNG保存できます。`;
  saveJsonButton.disabled = slideDataList.length === 0;
  downloadAllButton.disabled = slideDataList.length === 0;
}

function createSlideToolbar(slideData, index, slideCount) {
  const toolbar = document.createElement('div');
  toolbar.className = 'slide-toolbar';

  const label = document.createElement('span');
  label.className = 'slide-number-label';
  label.textContent = `Slide ${String(index + 1).padStart(2, '0')}`;
  toolbar.appendChild(label);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'slide-action-group';

  const moveUpButton = createActionButton('上へ', () => moveSlide(index, -1), index === 0);
  const moveDownButton = createActionButton('下へ', () => moveSlide(index, 1), index === slideCount - 1);
  const duplicateButton = createActionButton('複製', () => duplicateSlide(index));
  const deleteButton = createActionButton('削除', () => deleteSlide(index), slideCount <= 1, 'danger-button');
  const downloadButton = createActionButton('このスライドをPNG保存', () => {
    const slideElement = document.querySelector(`[data-slide-id="${slideData.id}"] .slide`);
    downloadSlideAsPng(slideElement, index + 1);
  }, false, 'download-button');

  [moveUpButton, moveDownButton, duplicateButton, deleteButton, downloadButton].forEach((button) => {
    buttonGroup.appendChild(button);
  });

  toolbar.appendChild(buttonGroup);
  return toolbar;
}

function createSlideEditor(slideData, index) {
  const editor = document.createElement('div');
  editor.className = 'slide-editor';

  const titleLabel = document.createElement('label');
  titleLabel.className = 'editor-field';
  titleLabel.innerHTML = '<span>タイトル編集</span>';
  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.value = slideData.title;
  titleInput.addEventListener('input', (event) => updateSlideText(index, 'title', event.target.value));
  titleLabel.appendChild(titleInput);

  const bodyLabel = document.createElement('label');
  bodyLabel.className = 'editor-field';
  bodyLabel.innerHTML = '<span>本文編集</span>';
  const bodyInput = document.createElement('textarea');
  bodyInput.rows = 4;
  bodyInput.value = slideData.body;
  bodyInput.addEventListener('input', (event) => updateSlideText(index, 'body', event.target.value));
  bodyLabel.appendChild(bodyInput);

  editor.appendChild(titleLabel);
  editor.appendChild(bodyLabel);

  if (slideData.diagramPrompt) {
    const diagramLabel = document.createElement('label');
    diagramLabel.className = 'editor-field';
    diagramLabel.innerHTML = '<span>図表指示編集</span>';
    const diagramInput = document.createElement('textarea');
    diagramInput.rows = 2;
    diagramInput.value = slideData.diagramPrompt;
    diagramInput.addEventListener('input', (event) => updateSlideText(index, 'diagramPrompt', event.target.value));
    diagramLabel.appendChild(diagramInput);
    editor.appendChild(diagramLabel);
  }
  return editor;
}

function createActionButton(label, onClick, disabled = false, extraClassName = '') {
  const button = document.createElement('button');
  button.className = ['small-button', extraClassName].filter(Boolean).join(' ');
  button.type = 'button';
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function updateSlideText(index, fieldName, value) {
  const slideData = currentSlideDataList[index];
  if (!slideData) return;

  slideData[fieldName] = value;

  const slideCard = slidesContainer.querySelectorAll('.slide-card')[index];
  if (!slideCard) return;

  const targetSelector = fieldName === 'title' ? '.slide-title' : '.slide-body';
  const previewText = fieldName === 'diagramPrompt' ? null : slideCard.querySelector(targetSelector);
  if (previewText) previewText.textContent = value;

  if (fieldName === 'diagramPrompt') {
    const diagramArea = slideCard.querySelector('.diagram-area');
    if (diagramArea) diagramArea.replaceWith(createDiagramAreaElement(slideData));
  }

  if (fieldName === 'title') {
    const image = slideCard.querySelector('.image-area img');
    if (image) image.alt = `${value}に関連するスキャン画像`;
  }
}

function moveSlide(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= currentSlideDataList.length) return;

  [currentSlideDataList[index], currentSlideDataList[nextIndex]] = [
    currentSlideDataList[nextIndex],
    currentSlideDataList[index],
  ];
  normalizeSlideTypes();
  renderSlides(currentSlideDataList);
}

function duplicateSlide(index) {
  const sourceSlide = currentSlideDataList[index];
  if (!sourceSlide) return;

  const duplicatedSlide = {
    ...sourceSlide,
    id: createSlideId(),
    title: `${sourceSlide.title}（コピー）`,
    createdAt: new Date().toISOString(),
  };

  currentSlideDataList.splice(index + 1, 0, duplicatedSlide);
  normalizeSlideTypes();
  renderSlides(currentSlideDataList);
}

function downloadProjectJson() {
  const projectJson = buildProjectJson(currentSlideDataList);
  const blob = new Blob([JSON.stringify(projectJson, null, 2)], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = createProjectFileName(new Date());
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function buildProjectJson(slideDataList, createdAt = new Date().toISOString()) {
  return {
    format: PROJECT_FORMAT,
    schemaVersion: SUPPORTED_PROJECT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt,
    slideOrder: slideDataList.map((slideData) => slideData.id),
    slides: slideDataList.map((slideData, index) => ({
      order: index + 1,
      id: slideData.id,
      type: slideData.type,
      title: slideData.title,
      body: slideData.body,
      imageDataUrl: slideData.imageDataUrl || null,
      diagramPrompt: slideData.diagramPrompt || '',
      createdAt: slideData.createdAt || createdAt,
    })),
  };
}

function parseProjectJson(projectText) {
  let projectData;

  try {
    projectData = JSON.parse(projectText);
  } catch (error) {
    throw new Error('JSONとして解析できません。ファイル内容が壊れていないか確認してください。');
  }

  validateProjectJson(projectData);
  return projectData.slides.map((slideData, index) => normalizeImportedSlideData(slideData, index));
}

function validateProjectJson(projectData) {
  if (!projectData || typeof projectData !== 'object' || Array.isArray(projectData)) {
    throw new Error('このアプリ用のプロジェクトJSONではありません。');
  }

  if (projectData.format !== PROJECT_FORMAT) {
    throw new Error('このアプリ用のプロジェクトJSONではありません。JSON保存ボタンで保存したファイルを選択してください。');
  }

  if (!Array.isArray(projectData.slides)) {
    throw new Error('slides配列が見つかりません。保存済みプロジェクトJSONか確認してください。');
  }

  if (projectData.slides.length === 0) {
    throw new Error('slides配列が空です。1枚以上のスライドを含むJSONを選択してください。');
  }
}

function normalizeImportedSlideData(slideData, index) {
  if (!slideData || typeof slideData !== 'object' || Array.isArray(slideData)) {
    throw new Error(`slides[${index}] の形式が不正です。`);
  }

  const title = typeof slideData.title === 'string' ? slideData.title : '';
  const body = typeof slideData.body === 'string' ? slideData.body : '';
  const imageDataUrl = typeof slideData.imageDataUrl === 'string' && slideData.imageDataUrl ? slideData.imageDataUrl : null;
  const diagramPrompt = typeof slideData.diagramPrompt === 'string' ? slideData.diagramPrompt.trim() : '';
  const fallbackType = getSlideTypeForContent(index, imageDataUrl, diagramPrompt);
  const type = VALID_SLIDE_TYPES.includes(slideData.type) ? slideData.type : fallbackType;

  return {
    id: typeof slideData.id === 'string' && slideData.id.trim() ? slideData.id : createSlideId(),
    type,
    title: title || `スライド ${index + 1}`,
    body: body || '本文を入力してください。',
    imageDataUrl,
    diagramPrompt,
    createdAt: typeof slideData.createdAt === 'string' && slideData.createdAt ? slideData.createdAt : new Date().toISOString(),
  };
}

function createProjectFileName(date) {
  return `upjuku-slide-project-${formatDateTimeForFileName(date)}.json`;
}

function formatDateTimeForFileName(date) {
  const parts = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
  ].map((part) => String(part).padStart(2, '0'));

  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}${parts[5]}`;
}

function deleteSlide(index) {
  if (currentSlideDataList.length <= 1) return;

  currentSlideDataList.splice(index, 1);
  normalizeSlideTypes();
  renderSlides(currentSlideDataList);
}

function normalizeSlideTypes() {
  currentSlideDataList = currentSlideDataList.map((slideData, index) => ({
    ...slideData,
    type: getNormalizedSlideType(slideData, index),
  }));
}

function getNormalizedSlideType(slideData, index) {
  if (slideData.imageDataUrl) return 'imageExplanation';
  if (slideData.diagramPrompt) return 'diagramExplanation';
  if (index === 0) return 'title';
  if (slideData.type === 'diagramExplanation') return 'diagramExplanation';
  return 'explanation';
}

function createSlideElement(slideData, index) {
  return createVisualAreaElement(slideData, index);
}

function createVisualAreaElement(slideData, index) {
  const visualArea = document.createElement('section');
  visualArea.className = `slide ${getSlideClassName(slideData.type)}`;
  visualArea.dataset.slideNumber = String(index + 1);

  const innerArea = document.createElement('div');
  innerArea.className = 'slide-content';

  innerArea.appendChild(createTextElement('div', 'slide-kicker', getSlideKicker(slideData.type, index)));
  innerArea.appendChild(createTextElement('h2', 'slide-title', slideData.title));

  if (slideData.imageDataUrl) {
    innerArea.appendChild(createImageAreaElement(slideData));
  } else if (slideData.diagramPrompt) {
    innerArea.appendChild(createDiagramAreaElement(slideData));
  }

  innerArea.appendChild(createTextElement('p', 'slide-body', slideData.body));
  visualArea.appendChild(innerArea);
  visualArea.appendChild(createTextElement('div', 'slide-footer-mark', 'Up塾'));

  return visualArea;
}


function createDiagramAreaElement(slideData) {
  const diagramArea = document.createElement('div');
  diagramArea.className = 'diagram-area';
  diagramArea.setAttribute('aria-label', `図表: ${slideData.diagramPrompt}`);
  diagramArea.appendChild(createDiagramSvgElement(slideData.diagramPrompt));
  return diagramArea;
}

function createDiagramSvgElement(diagramPrompt) {
  const svg = createSvgElement('svg', {
    viewBox: '0 0 420 250',
    role: 'img',
  });
  const normalizedPrompt = diagramPrompt.replace(/\s+/g, ' ');

  if (/一次関数|グラフ|右上がり|右下がり/.test(normalizedPrompt)) {
    drawFunctionGraph(svg, normalizedPrompt);
  } else if (/比較/.test(normalizedPrompt)) {
    drawComparisonDiagram(svg);
  } else if (/矢印/.test(normalizedPrompt)) {
    drawArrowDiagram(svg);
  } else {
    drawPlaceholderDiagram(svg);
  }

  return svg;
}

function drawFunctionGraph(svg, prompt) {
  appendSvgTitle(svg, prompt);
  svg.appendChild(createSvgElement('rect', {
    x: 16,
    y: 14,
    width: 388,
    height: 220,
    rx: 18,
    fill: '#ffffff',
  }));

  [70, 120, 170, 220, 270, 320, 370].forEach((x) => {
    svg.appendChild(createSvgElement('line', {
      x1: x,
      y1: 42,
      x2: x,
      y2: 210,
      stroke: '#d9e8f7',
      'stroke-width': 2,
    }));
  });

  [70, 110, 150, 190].forEach((y) => {
    svg.appendChild(createSvgElement('line', {
      x1: 48,
      y1: y,
      x2: 380,
      y2: y,
      stroke: '#d9e8f7',
      'stroke-width': 2,
    }));
  });

  svg.appendChild(createSvgElement('line', {
    x1: 48,
    y1: 210,
    x2: 380,
    y2: 210,
    stroke: '#0d47a1',
    'stroke-width': 4,
    'stroke-linecap': 'round',
  }));
  svg.appendChild(createSvgElement('line', {
    x1: 70,
    y1: 222,
    x2: 70,
    y2: 42,
    stroke: '#0d47a1',
    'stroke-width': 4,
    'stroke-linecap': 'round',
  }));

  if (/右上がり/.test(prompt) || !/右下がり/.test(prompt)) {
    drawTrendLine(svg, 92, 184, 354, 72, '#1e88e5', '右上がり');
  }

  if (/右下がり/.test(prompt)) {
    drawTrendLine(svg, 92, 74, 354, 184, '#d84315', '右下がり');
  }
}

function drawTrendLine(svg, x1, y1, x2, y2, color, label) {
  svg.appendChild(createSvgElement('line', {
    x1,
    y1,
    x2,
    y2,
    stroke: color,
    'stroke-width': 8,
    'stroke-linecap': 'round',
  }));
  svg.appendChild(createSvgElement('circle', { cx: x1, cy: y1, r: 8, fill: color }));
  svg.appendChild(createSvgElement('circle', { cx: x2, cy: y2, r: 8, fill: color }));
  svg.appendChild(createSvgText(label, x2 - 78, y2 - 14, color, 20));
}

function drawComparisonDiagram(svg) {
  appendSvgTitle(svg, '比較');
  svg.appendChild(createSvgElement('rect', {
    x: 28,
    y: 28,
    width: 364,
    height: 194,
    rx: 24,
    fill: '#ffffff',
  }));

  const bars = [
    { label: 'A', height: 72, x: 106, color: '#1e88e5' },
    { label: 'B', height: 126, x: 230, color: '#ffb300' },
  ];

  bars.forEach((bar) => {
    svg.appendChild(createSvgElement('rect', {
      x: bar.x,
      y: 184 - bar.height,
      width: 78,
      height: bar.height,
      rx: 12,
      fill: bar.color,
    }));
    svg.appendChild(createSvgText(bar.label, bar.x + 28, 211, '#0d47a1', 24));
  });

  svg.appendChild(createSvgText('比較', 178, 68, '#0d47a1', 28));
}

function drawArrowDiagram(svg) {
  appendSvgTitle(svg, '矢印');
  svg.appendChild(createSvgElement('defs', {}, [
    createSvgElement('marker', {
      id: 'diagram-arrow-head',
      markerWidth: 10,
      markerHeight: 10,
      refX: 8,
      refY: 3,
      orient: 'auto',
      markerUnits: 'strokeWidth',
    }, [
      createSvgElement('path', {
        d: 'M0,0 L0,6 L9,3 z',
        fill: '#1e88e5',
      }),
    ]),
  ]));

  ['入力', '考える', '答え'].forEach((label, index) => {
    const x = 32 + index * 138;
    svg.appendChild(createSvgElement('rect', {
      x,
      y: 86,
      width: 96,
      height: 78,
      rx: 18,
      fill: '#ffffff',
      stroke: '#ffb300',
      'stroke-width': 5,
    }));
    svg.appendChild(createSvgText(label, x + 21, 134, '#0d47a1', 22));
  });

  [128, 266].forEach((x) => {
    svg.appendChild(createSvgElement('line', {
      x1: x,
      y1: 125,
      x2: x + 42,
      y2: 125,
      stroke: '#1e88e5',
      'stroke-width': 8,
      'stroke-linecap': 'round',
      'marker-end': 'url(#diagram-arrow-head)',
    }));
  });
}

function drawPlaceholderDiagram(svg) {
  appendSvgTitle(svg, '図表');
  svg.appendChild(createSvgElement('rect', {
    x: 30,
    y: 36,
    width: 360,
    height: 178,
    rx: 24,
    fill: '#ffffff',
    stroke: '#ffb300',
    'stroke-width': 5,
  }));
  svg.appendChild(createSvgText('図表', 168, 124, '#0d47a1', 34));
}

function appendSvgTitle(svg, text) {
  const title = createSvgElement('title');
  title.textContent = text;
  svg.appendChild(title);
}

function createSvgElement(tagName, attributes = {}, children = []) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);

  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });

  children.forEach((child) => element.appendChild(child));
  return element;
}

function createSvgText(text, x, y, fill, fontSize) {
  const textElement = createSvgElement('text', {
    x,
    y,
    fill,
    'font-size': fontSize,
    'font-weight': 900,
    'font-family': 'sans-serif',
  });
  textElement.textContent = text;
  return textElement;
}

function createImageAreaElement(slideData) {
  const imageArea = document.createElement('div');
  imageArea.className = 'image-area';

  const image = document.createElement('img');
  image.src = slideData.imageDataUrl;
  image.alt = `${slideData.title}に関連するスキャン画像`;
  imageArea.appendChild(image);

  return imageArea;
}

function getSlideClassName(type) {
  const classNames = {
    title: 'title-slide',
    explanation: 'explanation-slide',
    imageExplanation: 'image-explanation-slide',
    diagramExplanation: 'diagram-explanation-slide',
  };

  return classNames[type] || classNames.explanation;
}

function getSlideKicker(type, index) {
  if (type === 'title') return '今日のテーマ';
  if (type === 'imageExplanation') return `資料で確認 ${index}`;
  if (type === 'diagramExplanation') return `図解 ${index}`;
  return `ポイント ${index}`;
}

function createTextElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = textContent;
  return element;
}

async function readImageFilesAsDataUrls(files) {
  const imageFiles = files.filter((file) => file.type.startsWith('image/'));
  return Promise.all(imageFiles.map(readFileAsDataUrl));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(file, 'utf-8');
  });
}

async function downloadSlideAsPng(slideElement, slideNumber) {
  if (!window.html2canvas) {
    alert('PNG出力ライブラリの読み込みに失敗しました。インターネット接続を確認してください。');
    return;
  }

  const canvas = await window.html2canvas(slideElement, {
    backgroundColor: null,
    scale: 2,
    useCORS: true,
  });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = `upjuku-slide-${String(slideNumber).padStart(3, '0')}.png`;
  link.click();
}

function showEmptyState(message) {
  currentSlideDataList = [];
  slidesContainer.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
  slideCountText.textContent = 'まだスライドは生成されていません。';
  saveJsonButton.disabled = true;
  downloadAllButton.disabled = true;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
