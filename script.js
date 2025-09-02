import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
const state = {
    personas: [],
    surveyResults: [],
    surveyQuestions: [],
    surveyOptions: [],
    charts: [],
    generatedCode: '',
    segmentData: {},
    currentSegmentKey: "",
    llmConfig: null,
    colorScales: {},
    segmentPrompt: "",
    fieldsList: "",
    demoFiles: [], 
    segmentIcons: { 
        segment1: "images/img_1.png", segment2: "images/img_2.png", segment3: "images/img_3.png"
    }
};

const elements = {};
let questionModalInstance = null;
const CONSTANTS = {
    CHART_COLORS: [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", 
        "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", 
        "#bcbd22", "#17becf", "#aec7e8", "#ffbb78"
    ],
    ANALYSIS_CHART_COLOR: "#e64d6cff"
};

const utils = {
    cacheElements() {
        const selectors = {
            providerStatus: '#providerStatus',
            personaModelSelect: '#modelSelect',
            surveyModelSelect: '#surveyModelSelect',
            segmentCardsContainer: '#segmentCardsContainer',
            personaConfigSection: '#personaConfigSection',
            generatedCodeSection: '#generatedCodeSection',
            personasSection: '#personasSection',
            surveySection: '#surveySectionWrapper', 
            resultsSection: '#resultsSectionWrapper', 
            numPersonas: '#numPersonas',
            numPersonasValue: '#numPersonasValue',
            surveyParticipants: '#surveyParticipants',
            surveyParticipantsValue: '#surveyParticipantsValue',
            generatedCode: '#generatedCode',
            personaTableHeader: '#personaTableHeader',
            personaTableBody: '#personaTableBody',
            personaCount: '#personaCount',
            surveyResultsMatrix: '#surveyResultsMatrix',
            chartsContainer: '#chartsContainer',
            filterControls: '#filterControls',
            resultsTableHeader: '#resultsTableHeader',
            resultsTableBody: '#resultsTableBody',
            responseCount: '#responseCount',
            dynamicQuestionsContainer: '#dynamicQuestionsContainer',
            sidebar: '#sidebar',
            mainContent: '#main-content',
            sidebarToggle: '#sidebar-toggle'
        };
        Object.entries(selectors).forEach(([key, selector]) => {
            elements[key] = document.querySelector(selector);
        });
    },
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);func(...args);};
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
        };
    },
    downloadCsv(data, filename, errorMessage) {
        if (!data?.length) {
            ui.showError(errorMessage || "No data to download");
            return;
        }
        const fields = Object.keys(data[0]);
        const csvRows = [
            fields.join(','),
            ...data.map(item =>
                fields.map(field => {
                    let value = String(item[field] || '');
                    return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
                }).join(',')
            )
        ];
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = Object.assign(document.createElement('a'), {
            href: url,
            download: filename,
            style: { display: 'none' }
        });
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },
    selectRandomIndices(max, count) {
        const indices = Array.from({ length: max }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices.slice(0, count);
    },
};
const scrollSpyTarget = document.body;
bootstrap.ScrollSpy.getInstance(scrollSpyTarget)?.dispose();
new bootstrap.ScrollSpy(scrollSpyTarget, {
  target: '#sidebar-nav',
  offset: 100
});

const ui = {
    updateProviderStatus() {
        const { llmConfig } = state;
        const hasValidConfig = llmConfig?.baseURL && llmConfig?.apiKey;
        elements.providerStatus.innerHTML = hasValidConfig 
            ? '<i class="bi bi-check-circle text-success me-1"></i>Connected to Provider'
            : '<i class="bi bi-exclamation-circle me-1"></i>No provider configured';
        elements.providerStatus.className = `provider-status ${hasValidConfig ? 'text-success' : 'text-muted'}`;
    },
    updateModelOptions() {
        const { llmConfig } = state;
        const selects = [elements.personaModelSelect, elements.surveyModelSelect];
        if (!llmConfig?.models?.length) return;
        const PREFERRED_MODELS = ['gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini'];
        const modelsList = llmConfig.models.map(model => {
            let id, name;
            if (typeof model === 'string') {
                id = model;
            } else if (typeof model === 'object' && model) {
                id = model.id || model.name || model.model || String(model);
            } else {
                id = String(model);
            }
            name = id.includes('/') ? id.split('/').pop() : id;
            return { id, name };
        }).filter(model => model.id);
        const filteredModels = modelsList.filter(model => PREFERRED_MODELS.includes(model.name));
        if (!filteredModels.length) {
            console.warn('❗ No preferred models found:', modelsList.map(m => m.id));
            return;
        }
        filteredModels.sort((a, b) => {
            if (a.name === 'gpt-4.1-nano') return -1;
            if (b.name === 'gpt-4.1-nano') return 1;
            return 0;
        });
        selects.forEach((select, index) => {
            select.innerHTML = '';
            filteredModels.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                select.appendChild(option);
            });
            if (index === 0) { 
                const defaultModel = filteredModels.find(model => model.name === 'gpt-4.1-mini');
                if (defaultModel) {    select.value = defaultModel.id;  }
            } else if (index === 1) {
                const defaultModel = filteredModels.find(model => model.name === 'gpt-4.1-nano');
                if (defaultModel) {  select.value = defaultModel.id;  }
            }
        });
    },
    showError(message) {
        const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        document.getElementById('errorModalBody').textContent = message;
        errorModal.show();
    },
    updateProgress(progressBar, percentage, text) {
        if (!progressBar) return;
        const progressBarInner = progressBar.querySelector('.progress-bar');
        if (progressBarInner) {
            progressBarInner.style.width = `${percentage}%`;
            progressBarInner.textContent = text;
        }
        if (percentage >= 100) {
            setTimeout(() => progressBar.style.display = 'none', 1000);
        }
    },
    showSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'block';
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    },
    toggleSidebar() {
        elements.sidebar.classList.toggle('expanded');
        const icon = elements.sidebarToggle.querySelector('i');
        if (elements.sidebar.classList.contains('expanded')) {
            icon.classList.remove('bi-arrows-angle-expand');
            icon.classList.add('bi-arrows-angle-contract');
        } else {
            icon.classList.remove('bi-arrows-angle-contract');
            icon.classList.add('bi-arrows-angle-expand');
        }
    }
};

const api = {
    async makeAPICall(messages, model, temperature = 1, responseFormat = null) {
        const { llmConfig } = state;
        if (!llmConfig?.baseURL || !llmConfig?.apiKey) {
            throw new Error("API Error: No valid configuration");
        }
        const requestBody = { model, temperature, messages };
        if (responseFormat) requestBody.response_format = responseFormat;
        const response = await fetch(`${llmConfig.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${llmConfig.apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Synthetic Persona Survey'
            },
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
    }
};

const config = {
    async configureLLMProvider(show = false) {
        try {
            state.llmConfig = await openaiConfig({
                title: "Configure API Provider",
                baseURLLabel: "API Base URL",
                apiKeyLabel: "API Key",
                buttonLabel: "Save & Test Connection",
                defaultBaseUrls: [
                    "https://llmfoundry.straivedemo.com/openai/v1",
                    "https://llmfoundry.straive.com/openai/v1",
                    "https://aipipe.org/api/v1",
                    "https://openrouter.com/api/v1",
                    "https://api.openai.com/v1"
                ],
                show
            });
            ui.updateProviderStatus();
            ui.updateModelOptions();
            return state.llmConfig;
        } catch (error) {
            if (show) {
                ui.showError(`Provider configuration failed: ${error.message}`);
            } else {
                console.warn("No LLM provider configured yet:", error.message);
                ui.updateProviderStatus();
                ui.updateModelOptions();
            }
        }
    }
};

const segments = {
    async loadSegmentData(fileName, categoryKey) {
        try {
            const response = await fetch(fileName);
            const data = await response.json();
            state.segmentData = data[categoryKey];
            this.displaySegmentCards();
        } catch (error) {
            console.error("Error loading segment data:", error);
        }
    },
    displaySegmentCards() {
        elements.segmentCardsContainer.innerHTML = "";
        Object.entries(state.segmentData).forEach(([key, segmentInfo]) => {
            const icon = state.segmentIcons[key];
            const colDiv = document.createElement("div");
            colDiv.className = "col-md-4 mb-3";
            const cardDiv = document.createElement("div");
            cardDiv.className = "card segment-box shadow-sm position-relative";
            cardDiv.setAttribute("data-segment-key", key);
            cardDiv.innerHTML = `
                <button class="btn btn-sm btn-outline-primary edit-btn" title="Edit segment"><i class="bi bi-pencil-square"></i></button>
                <div class="card-body text-center">
                    <img src="${icon}" alt="${key} icon" class="segment-icon mb-2" />
                    <h5 class="card-title">${segmentInfo.name}</h5>
                    <div class="segment-description text-muted small mt-2 mb-2 text-start">
                        <ul class="mb-0">${segmentInfo.description.split('\n').map(line => `<li>${line.trim()}</li>`).join('')}</ul>
                    </div>
                </div>`;
            cardDiv.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation(); this.openEditModal(key);
            });
            cardDiv.addEventListener('click', () => this.selectSegment(cardDiv, key));
            colDiv.appendChild(cardDiv);
            elements.segmentCardsContainer.appendChild(colDiv);
        });
    },
    selectSegment(cardElement, key) {
        document.querySelectorAll(".segment-box").forEach(box => box.classList.remove("selected"));
        cardElement.classList.add("selected");
        state.currentSegmentKey = key;
        state.segmentPrompt = state.segmentData[key].description;
        state.fieldsList = state.segmentData[key].fields;
        ui.showSection("personaConfigSection");
    },
    openEditModal(segmentKey) {
        const selectedSegment = state.segmentData[segmentKey];
        document.getElementById("editSegmentKey").value = segmentKey;
        document.getElementById("editSegmentName").value = selectedSegment.name;
        document.getElementById("editSegmentDescription").value = selectedSegment.description;
        document.getElementById("editSegmentFields").value = selectedSegment.fields;
        const editModal = new bootstrap.Modal(document.getElementById('editSegmentModal'));
        editModal.show();
    },
    saveSegmentChanges() {
        const segmentKey = document.getElementById("editSegmentKey").value;
        const name = document.getElementById("editSegmentName").value;
        const description = document.getElementById("editSegmentDescription").value;
        const fields = document.getElementById("editSegmentFields").value;
        state.segmentData[segmentKey] = { ...state.segmentData[segmentKey], name, description, fields };
        if (segmentKey === state.currentSegmentKey) {
            state.segmentPrompt = description;
            state.fieldsList = fields;
        }
        this.displaySegmentCards();
        const editedCard = document.querySelector(`.segment-box[data-segment-key="${segmentKey}"]`);
        editedCard?.click();
        const modalElement = document.getElementById('editSegmentModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal?.hide();
    }
};

const personas = {
    async generateCode() {
        try {
            if (!state.currentSegmentKey) { ui.showError("Please select a segment first"); return; }
            if (!state.llmConfig?.baseURL || !state.llmConfig?.apiKey) { ui.showError("API Error: No valid configuration"); return; }
            const numPersonas = parseInt(elements.numPersonas.value);
            const model = elements.personaModelSelect.value;
            const progressBar = document.getElementById('generationProgress');
            progressBar.style.display = 'flex';
            progressBar.classList.remove('d-none');
            ui.updateProgress(progressBar, 50, 'Generating code...');
            const fieldsArray = state.fieldsList.split('\n').filter(line => line.trim());
            const prompt = this.buildPrompt(numPersonas, fieldsArray);
            const content = await api.makeAPICall([{ role: "user", content: prompt }], model, 1);
            state.generatedCode = this.extractCode(content);
            elements.generatedCode.textContent = state.generatedCode;
            document.getElementById('codeStatusBadge').textContent = 'Generated';
            elements.generatedCodeSection.style.display = 'block';
            ui.updateProgress(progressBar, 100, 'Code generated');
            document.getElementById('executeCodeBtn').disabled = false;
        } catch (error) {
            ui.showError(`Error generating code: ${error.message}`);
            console.error("Error generating code:", error);
            document.getElementById('generationProgress').classList.add('d-none');
        }
    },
    buildPrompt(numPersonas, fieldsArray) {
        return `Write a JavaScript code to generate REALISTIC fake data of ${numPersonas} rows of persona based on the following profile and fields provided. When listing possible values for fields, go beyond the examples above to be FULLY comprehensive. When picking values, use realistic distributions for each value based on real-life. <PROFILE>${state.segmentPrompt}</PROFILE><FIELDS>These are the fields I need for each persona:\n${fieldsArray.join('\n')}</FIELDS>Please provide ONLY JavaScript code that: 1. Defines a function called generatePersonas() that returns an array of ${numPersonas} persona objects. 2. Creates realistic, diverse data that matches the segment profile. 3. Properly uses randomization to create natural distributions of values. 4. Returns the data as an array of JSON objects, with each field as a key-value pair. The returned code should be ready to execute in a browser environment. DO NOT include any explanation text outside the JavaScript code itself.`;
    },
    extractCode(content) {
        const codeMatch = content.match(/```(?:javascript|js)?\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        return codeMatch ? codeMatch[1] : content;
    },
    executeCode() {
        try {
            const progressBar = document.getElementById('generationProgress1');
            progressBar.style.display = 'flex';
            progressBar.classList.remove('d-none');
            ui.updateProgress(progressBar, 50, 'Executing code...');
            state.personas = [];
            const executeCode = new Function(`
                try {
                    ${state.generatedCode}
                    return { success: true, result: generatePersonas() };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            `);
            const result = executeCode();
            if (!result.success) { throw new Error(`Code execution failed: ${result.error}`); }
            state.personas = result.result;
            if (!Array.isArray(state.personas) || !state.personas.length) { throw new Error("Code execution did not return an array of personas"); }
            ui.updateProgress(progressBar, 100, `${state.personas.length} personas generated`);
            this.displayPersonas();
            document.getElementById('downloadPersonasBtn').disabled = false;
            ui.showSection('personasSection');
            elements.surveySection.style.display = 'block';
            document.getElementById('runSurveyBtn').disabled = false;
        } catch (error) {
            ui.showError(`Error executing code: ${error.message}`);
            document.getElementById('generationProgress1').classList.add('d-none');
        }
    },
    displayPersonas() {
        if (!state.personas.length) return;
        elements.personaCount.textContent = state.personas.length;
        elements.personaTableHeader.innerHTML = '';
        elements.personaTableBody.innerHTML = '';
        const fields = Object.keys(state.personas[0]);
        const headerFragment = document.createDocumentFragment();
        fields.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field;
            headerFragment.appendChild(th);
        });
        elements.personaTableHeader.appendChild(headerFragment);
        const bodyFragment = document.createDocumentFragment();
        state.personas.forEach((persona, index) => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-index', index);
            fields.forEach(field => {
                const td = document.createElement('td');
                td.textContent = persona[field];
                tr.appendChild(td);
            });
            bodyFragment.appendChild(tr);
        });
        elements.personaTableBody.appendChild(bodyFragment);
    }
};

const survey = {
    // NEW: Render dynamic questions UI
    renderDynamicQuestions() {
        elements.dynamicQuestionsContainer.innerHTML = '';
        if (state.surveyQuestions.length === 0) {
            elements.dynamicQuestionsContainer.innerHTML = `<p class="text-muted small p-3 text-center">No survey questions added yet. Click "Add Question" to start.</p>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        state.surveyQuestions.forEach((question, index) => {
            const options = state.surveyOptions[index] || [];
            const questionKey = `question_${index + 1}`;
            const colorScale = state.colorScales[questionKey];

            const optionsHtml = options.map(opt => `
                <div class="d-flex align-items-center option-item small text-muted">
                    <span class="option-color-dot" style="background-color: ${colorScale ? colorScale(opt) : '#ccc'};"></span>
                    <span>${opt}</span>
                </div>
            `).join('');

            const card = document.createElement('div');
            card.className = 'card question-card mb-3 shadow-sm';
            card.innerHTML = `
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="card-title mb-1">Q${index + 1}: ${question}</h6>
                            <div class="d-flex flex-wrap gap-3 mt-2">${optionsHtml}</div>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary py-0 px-2 edit-question-btn" data-index="${index}" title="Edit Question"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger py-0 px-2 remove-question-btn" data-index="${index}" title="Remove Question"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
            fragment.appendChild(card);
        });
        elements.dynamicQuestionsContainer.appendChild(fragment);
    },
    openQuestionModal(index = null) {
        const form = document.getElementById('questionForm');
        form.reset();
        const indexInput = document.getElementById('questionModalIndex');
        
        if (index !== null && state.surveyQuestions[index]) {
            document.getElementById('questionText').value = state.surveyQuestions[index];
            document.getElementById('questionOptions').value = state.surveyOptions[index].join('\n');
            indexInput.value = index;
        } else {
            indexInput.value = '';
        }
        questionModalInstance.show();
    },

    saveQuestion() {
        const question = document.getElementById('questionText').value.trim();
        const options = document.getElementById('questionOptions').value.split('\n').map(o => o.trim()).filter(Boolean);
        const index = document.getElementById('questionModalIndex').value;

        if (!question || options.length < 2) {
            ui.showError("Please provide a question and at least two options.");
            return;
        }

        if (index !== '') {
            state.surveyQuestions[index] = question;
            state.surveyOptions[index] = options;
        } else { 
            state.surveyQuestions.push(question);
            state.surveyOptions.push(options);
        }
        results.generateColorScales(); 
        this.renderDynamicQuestions(); 
        questionModalInstance.hide();
    },

    removeQuestion(index) {
        if (confirm(`Are you sure you want to remove Q${index + 1}?`)) {
            state.surveyQuestions.splice(index, 1);
            state.surveyOptions.splice(index, 1);
            results.generateColorScales();
            this.renderDynamicQuestions();
        }
    },

    generateJsonSchema() {
        if (!state.surveyQuestions.length) {
            ui.showError("Please add survey questions first.");
            return null;
        }
        const schema = { type: "object", properties: {}, required: [], additionalProperties: false };
        state.surveyQuestions.forEach((question, index) => {
            const questionId = `question_${index + 1}`;
            const options = state.surveyOptions[index];
            schema.properties[questionId] = { type: "string", description: question, enum: options };
            schema.properties[`${questionId}_reasoning`] = { type: "string", description: `Reasoning for ${question}` };
            schema.required.push(questionId, `${questionId}_reasoning`);
        });
        return schema;
    },

    async processBatch(participants, batchIndex, model, temperature, schema) {
        const batchResults = [];
        for (let i = 0; i < participants.length; i++) {
            const persona = participants[i];
            const participantIndex = batchIndex * participants.length + i;
            try {
                const personaDescription = Object.entries(persona).map(([key, value]) => `${key}: ${value}`).join('\n');
                const systemPrompt = `You are a survey participant with the following profile:\n${personaDescription}\n\nYour task is to answer survey questions authentically as this specific person would respond. IMPORTANT: Your profile should strongly influence your choices. Different personas should have different preferences. - People with different backgrounds and values will naturally choose different options - Don't pick what you think is objectively "best" - pick what YOUR CHARACTER would choose - Be true to the psychological traits, values, and background of your persona`;
                const questionsPrompt = state.surveyQuestions.map((q, idx) => `${q} (Choose one: ${state.surveyOptions[idx].join(', ')})`).join('\n\n');
                const responseFormat = { type: "json_schema", json_schema: { name: "surveyResponse", strict: true, schema } };
                const content = await api.makeAPICall([
                    { role: "system", content: systemPrompt },
                    { role: "user", content: `Please answer the following survey questions by choosing one of the options(enum). For each answer, provide a detailed reasoning explaining WHY you selected that option based on your persona's characteristics. you must respond with valid JSON only, that must use double quotes for all keys and string values, include commas between all key-value pairs, contain no trailing commas with no extra text or markdown outside the JSON object, it must have same keys that is defined in the schema, include all required fields.\n\n Questions:\n${questionsPrompt}` }
                ], model, temperature, responseFormat);
                let answerData;
                try {
                    answerData = JSON.parse(content);
                } catch (e) {
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) { answerData = JSON.parse(jsonMatch[0]); } 
                    else { console.warn(`Could not parse JSON for participant ${participantIndex + 1}. Skipping.`); continue; }
                }
                batchResults.push({ participant_id: participantIndex + 1, ...persona, ...answerData });
            } catch (error) {
                console.error(`Error processing participant ${participantIndex + 1}:`, error);
            }
        }
        return batchResults;
    },

    async runSurvey() {
        try {        
            const progressBar = document.getElementById('surveyProgress');
            document.getElementById('surveySectionWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            progressBar.classList.remove('d-none');
            progressBar.style.display = 'block';
            ui.updateProgress(progressBar, 5, 'Starting survey...');
            if (!state.personas.length) { ui.showError("Please generate personas first"); return; }
            if (!state.llmConfig?.baseURL || !state.llmConfig?.apiKey) { ui.showError("Please configure your API provider first"); return; }
            const schema = this.generateJsonSchema();
            if (!schema) return;
            const numParticipants = Math.min(parseInt(elements.surveyParticipants.value), state.personas.length);
            const temperature = 1; 
            const model = elements.surveyModelSelect.value;
            const selectedIndices = utils.selectRandomIndices(state.personas.length, numParticipants);
            const participants = selectedIndices.map(index => state.personas[index]);
            document.getElementById('downloadSurveyCsvBtn').classList.add('d-none');
            document.getElementById('runSurveyBtn').disabled = true;
            state.surveyResults = [];
            elements.surveyResultsMatrix.innerHTML = '';
            elements.responseCount.textContent = '0';
            const batchSize = 2;
            const batches = Array.from({ length: Math.ceil(participants.length / batchSize) }, (_, i) =>
                participants.slice(i * batchSize, i * batchSize + batchSize)
            );
            const batchPromises = batches.map((batch, index) => this.processBatch(batch, index, model, temperature, schema));
            let completedParticipants = 0;
            const progressUpdater = setInterval(() => {
            const base = 5;    const max = 95;
            const progress = Math.round(base + (completedParticipants / participants.length) * (max - base));
            ui.updateProgress(progressBar, progress, `Processed ${completedParticipants} of ${participants.length} (${progress}%)`);
                elements.responseCount.textContent = completedParticipants.toString();
            }, 500);
            
            const processedResults = [];
            for (const promise of batchPromises) {
                const batchResult = await promise;
                processedResults.push(...batchResult);
                completedParticipants += batchResult.length;
                results.renderOMRCMatrix(processedResults); 
            }
            
            clearInterval(progressUpdater);
            state.surveyResults = processedResults.sort((a, b) => a.participant_id - b.participant_id);
            completedParticipants = state.surveyResults.length;
            ui.updateProgress(progressBar, 100, `Processed ${completedParticipants} of ${participants.length} (100%)`);
            elements.responseCount.textContent = completedParticipants.toString();
            results.renderOMRCMatrix(); 
            results.renderCharts();
            document.getElementById('runSurveyBtn').disabled = false;
            document.getElementById('downloadSurveyCsvBtn').disabled = false;
            document.getElementById('downloadSurveyCsvBtn').classList.remove('d-none');
            document.getElementById('downloadResultsBtn').disabled = false;
            ui.showSection('resultsSectionWrapper');
        } catch (error) {
            console.error("Error running survey:", error);
            ui.showError(`Error running survey: ${error.message}`);
        }
    }
};

const results = {
    generateColorScales() {
        state.colorScales = {};
        state.surveyQuestions.forEach((_, index) => {
            const questionKey = `question_${index + 1}`;
            const options = state.surveyOptions[index] || [];
            state.colorScales[questionKey] = d3.scaleOrdinal()
                .domain(options)
                .range(CONSTANTS.CHART_COLORS.slice(0, options.length));
        });
    },

    renderOMRCMatrix(data = state.surveyResults) {
        const container = elements.surveyResultsMatrix;
        container.innerHTML = '';

        if (!data.length) {
            container.innerHTML = `<p class="text-muted small"><i class="bi bi-info-circle me-1"></i>Survey responses will appear here as a matrix...</p>`;
            return;
        }
        const questionKeys = Object.keys(data[0] || {}).filter(key => key.startsWith('question_') && !key.includes('_reasoning'));
        const displayResults = data.slice(0, 30);
        const table = document.createElement('table');
        table.className = 'response-matrix-table';
        const thead = table.createTHead();
        const headerRow = thead.insertRow();
        headerRow.innerHTML = `<th>Participant.</th>` + questionKeys.map((_, i) => `<th>Q${i + 1}</th>`).join('');
        const tbody = table.createTBody();
        displayResults.forEach(result => {
            const row = tbody.insertRow();
            row.insertCell().textContent = `P${result.participant_id}`;
            questionKeys.forEach(qKey => {
                const cell = row.insertCell();
                const answer = result[qKey];
                if (answer) {
                    const color = state.colorScales[qKey](answer);
                    const dot = document.createElement('span');
                    dot.className = 'response-dot';
                    dot.style.backgroundColor = color;
                    dot.dataset.tooltipContent = `
                        <strong>Participant ${result.participant_id}</strong><br>
                        <strong>Question:</strong> ${state.surveyQuestions[questionKeys.indexOf(qKey)]}<br>
                        <strong>Answer:</strong> ${answer}<br>
                        <strong>Reasoning:</strong> ${result[qKey + '_reasoning']}
                    `;
                    cell.appendChild(dot);
                }
            });
        });
        container.appendChild(table);
        const helpText = document.createElement("p");
        helpText.className = "text-muted small mt-2";
        helpText.innerHTML = "<i class='bi bi-cursor me-1'></i>Hover over circles to see details. Showing first 30 participants.";
        container.appendChild(helpText);
    },

    renderCharts() {
        if (!state.surveyResults.length) { ui.showError("No survey results to display"); return; }
        elements.chartsContainer.innerHTML = '';
        state.charts.forEach(chart => chart.destroy());
        state.charts = [];
        const questionKeys = Object.keys(state.surveyResults[0] || {}).filter(key => key.startsWith('question_') && !key.includes('_reasoning'));
        questionKeys.forEach((questionKey, index) => {
            const chart = this.createChart(questionKey, index);
            if (chart) state.charts.push(chart);
        });
        this.generateFilters();
        this.populateResultsTable();
    },

    createChart(questionKey, index) {
        const questionText = state.surveyQuestions[index];
        const responses = {};
        state.surveyResults.forEach(result => {
            const answer = result[questionKey];
            responses[answer] = (responses[answer] || 0) + 1;
        });
        const chartCol = document.createElement('div');
        chartCol.className = 'col';
        chartCol.innerHTML = `<div class="card h-100"><div class="card-header">${questionText}</div><div class="card-body" style="height: 200px;"><canvas id="chart-${questionKey}"></canvas></div></div>`;
        elements.chartsContainer.appendChild(chartCol);
        const canvas = document.getElementById(`chart-${questionKey}`);
        const ctx = canvas.getContext('2d');
        const options = state.surveyOptions[index];
        const chartData = options.map(option => responses[option] || 0);
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: options,
                datasets: [{
                    label: 'Responses',
                    data: chartData,
                    backgroundColor: CONSTANTS.ANALYSIS_CHART_COLOR,
                    borderColor: d3.color(CONSTANTS.ANALYSIS_CHART_COLOR).darker(0.3).formatHex(),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Responses' } } }
            }
        });
    },

    generateFilters() {
        if (!state.surveyResults.length) return;
        elements.filterControls.innerHTML = '';
        const personaFields = Object.keys(state.surveyResults[0]).filter(key => !key.startsWith('question_') && key !== 'participant_id');
        const fragment = document.createDocumentFragment();
        personaFields.forEach(field => {
            const uniqueValues = [...new Set(state.surveyResults.map(result => result[field]))];
            if (uniqueValues.length > 15 || field === 'ID') return;
            const filterCol = document.createElement('div');
            filterCol.className = 'mb-3';
            filterCol.innerHTML = `<label class="form-label" for="filter-${field}">${field}</label><select class="form-select filter-control" id="filter-${field}" data-field="${field}"><option value="all">All</option>${uniqueValues.sort().map(value => `<option value="${value}">${value}</option>`).join('')}</select>`;
            const select = filterCol.querySelector('select');
            select.addEventListener('change', () => this.applyFilters());
            fragment.appendChild(filterCol);
        });
        elements.filterControls.appendChild(fragment);
    },
    applyFilters() {
        const filterControls = document.querySelectorAll('.filter-control');
        const filters = {};
        filterControls.forEach(control => {
            const field = control.getAttribute('data-field');
            const value = control.value;
            if (value !== 'all') filters[field] = value;
        });
        const filteredResults = state.surveyResults.filter(result => Object.entries(filters).every(([field, value]) => String(result[field]) === String(value)));
        this.updateCharts(filteredResults);
        this.populateResultsTable(filteredResults);
    },
    updateCharts(filteredResults) {
        if (!filteredResults?.length) {
            state.charts.forEach(chart => {
                chart.data.datasets[0].data.fill(0);
                chart.update();
            });
            return;
        }
        const questionKeys = Object.keys(filteredResults[0]).filter(key => key.startsWith('question_') && !key.includes('_reasoning'));
        questionKeys.forEach((questionKey, index) => {
            const responses = {};
            filteredResults.forEach(result => {
                const answer = result[questionKey];
                responses[answer] = (responses[answer] || 0) + 1;
            });
            if (!state.surveyOptions[index]?.length) return;
            const chartData = state.surveyOptions[index].map(option => responses[option] || 0);
            const chart = state.charts[index];
            if (chart) {
                chart.data.datasets[0].data = chartData;
                chart.update();
            }
        });
    },
    resetFilters() {
        document.querySelectorAll('.filter-control').forEach(control => { control.value = 'all'; });
        this.applyFilters();
    },
    populateResultsTable(data = null) {
        const tableData = data || state.surveyResults;
        if (!tableData.length) {
            elements.resultsTableBody.innerHTML = `<tr><td colspan="${elements.resultsTableHeader.children.length}">No results match the filter.</td></tr>`;
            return;
        }
        elements.resultsTableHeader.innerHTML = '';
        elements.resultsTableBody.innerHTML = '';
        const fields = Object.keys(tableData[0]);
        const headerFragment = document.createDocumentFragment();
        fields.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field;
            headerFragment.appendChild(th);
        });
        elements.resultsTableHeader.appendChild(headerFragment);
        const bodyFragment = document.createDocumentFragment();
        tableData.forEach(result => {
            const tr = document.createElement('tr');
            fields.forEach(field => {
                const td = document.createElement('td');
                const value = result[field] || '';
                if (typeof value === 'string' && value.length > 70) {
                    td.textContent = value.substring(0, 70) + '...';
                    td.title = value;
                } else {
                    td.textContent = value;
                }
                tr.appendChild(td);
            });
            bodyFragment.appendChild(tr);
        });
        elements.resultsTableBody.appendChild(bodyFragment);
    }
};
const demoToSegmentMap = {
    "Top Fuel and Convenience Retailer - Synthetic Audience Survey": "Value Seeking Commuters",
    "Top Petcare Provider - Willingness to Pay Survey": "Budget-Conscious Suburban Owner"
};
const demo = {
    async loadDemoData(demoFile) {
        try {
            const demoInfo = state.demoFiles.find(d => d.file === demoFile);
            if (demoInfo && demoInfo.images) {
                const newIcons = {};
                demoInfo.images.forEach((img, index) => { newIcons[`segment${index + 1}`] = img; });
                state.segmentIcons = newIcons;
            }
            const segmentKey = demoFile.split('/').pop().replace('.json', '');
            document.querySelectorAll('.demo-card').forEach(card => card.classList.remove('selected'));
            document.querySelector(`.demo-card[data-file="${demoFile}"]`)?.classList.add('selected');
            await segments.loadSegmentData("segments.json", segmentKey);
            const demoTitle = demoInfo?.title?.trim();
            const targetSegmentName = demoToSegmentMap[demoTitle];
            if (targetSegmentName) {
                requestAnimationFrame(() => {
                    const targetCard = [...document.querySelectorAll('.card-body.text-center')]
                        .find(card => card.querySelector('.card-title')?.textContent.trim() === targetSegmentName);
                    targetCard?.click();
                });
            }
            document.getElementById('demoLoadingSpinner').classList.remove('d-none');
            const response = await fetch(demoFile);
            if (!response.ok) { throw new Error(`Failed to load demo file: ${response.statusText}`); }
            const demoData = await response.json();
            const { surveyQuestions, surveyOptions } = this.parseDemoQuestions(demoData.surveyQuestionsText || '');
            Object.assign(state, {
                segmentPrompt: demoData.segmentPrompt || '',
                fieldsList: demoData.fieldsList || '',
                generatedCode: demoData.generatedCode || '',
                personas: demoData.personas || [],
                surveyResults: demoData.surveyResults || [],
                surveyQuestions,
                surveyOptions
            });
            this.applyConfigSettings(demoData.configSettings);
            this.updateUIForDemo();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error('Error loading demo data:', error);
            ui.showError(`Error loading demo: ${error.message}`);
        } finally {
            document.getElementById('demoLoadingSpinner').classList.add('d-none');
        }
    },
    createCustomDemoCard() {
        const demosContainer = document.getElementById('demos');
        if (!demosContainer) return;
        const customCard = document.createElement('div');
        customCard.className = 'col mb-4';
        customCard.innerHTML = `
            <div class="card h-100 demo-card border-primary" role="button" style="cursor: pointer; border-width: 2px;" data-custom="true">
                <div class="card-body text-center">
                    <div class="d-flex justify-content-center align-items-center mb-3">
                        <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
                            <i class="bi bi-plus-lg" style="font-size: 1.5rem;"></i>
                        </div>
                    </div>
                    <h5 class="card-title text-primary">Create Your Own</h5>
                    <p class="card-text small text-muted">Define your own segment, questions, and run a custom survey from scratch</p>
                </div>
            </div>
        `;
        demosContainer.insertBefore(customCard, demosContainer.firstChild);
    },

    openCustomSegmentModal() {
        const modal = new bootstrap.Modal(document.getElementById('createCustomSegmentModal'));
        document.getElementById('createCustomSegmentForm').reset();
        modal.show();
    },

    resetAppState() {
        state.personas = [];
        state.surveyResults = [];
        state.surveyQuestions = [];
        state.surveyOptions = [];
        state.charts.forEach(chart => chart.destroy());
        state.charts = [];
        state.generatedCode = '';
        state.currentSegmentKey = "";
        state.colorScales = {};
        state.segmentPrompt = "";
        state.fieldsList = "";
        elements.personaCount.textContent = '0';
        elements.responseCount.textContent = '0';
        elements.generatedCode.textContent = '// Code will appear here...';
        elements.personaTableBody.innerHTML = '<tr><td>No personas generated yet</td></tr>';
        elements.surveyResultsMatrix.innerHTML = '<p class="text-muted small"><i class="bi bi-info-circle me-1"></i>Survey responses will appear here as a matrix...</p>';
        elements.chartsContainer.innerHTML = '<p class="text-muted small"><i class="bi bi-info-circle me-1"></i>Charts will appear here.</p>';
        elements.dynamicQuestionsContainer.innerHTML = '<p class="text-muted small p-3 text-center">No survey questions added yet. Click "Add Question" to start.</p>';
        ['generatedCodeSection', 'personasSection', 'surveySectionWrapper', 'resultsSectionWrapper'].forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) section.style.display = 'none';
        });
        ['executeCodeBtn', 'downloadPersonasBtn', 'runSurveyBtn', 'downloadSurveyCsvBtn', 'downloadResultsBtn'].forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.disabled = true;
        });
    },

    openCustomSegmentModal() {
        const modal = new bootstrap.Modal(document.getElementById('createCustomSegmentModal'));
        document.getElementById('createCustomSegmentForm').reset();
        modal.show();
    },

    async createCustomSegment() {
        const name = document.getElementById('customSegmentName').value.trim();
        const description = document.getElementById('customSegmentDescription').value.trim();
        const fields = document.getElementById('customSegmentFields').value.trim();
        if (!name || !description || !fields) {
            ui.showError("Please fill in all fields to create your custom segment.");
            return;
        }
        try {
            const customKey = 'custom_segment';
            state.segmentData = {
                [customKey]: {  name: name, description: description,  fields: fields  }
            };
            state.segmentIcons = {
            [customKey]: "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#0d6efd"/><rect x="25" y="35" width="50" height="45" fill="white" rx="2"/><rect x="30" y="42" width="8" height="8" fill="#0d6efd"/><rect x="46" y="42" width="8" height="8" fill="#0d6efd"/><rect x="62" y="42" width="8" height="8" fill="#0d6efd"/><rect x="30" y="55" width="8" height="8" fill="#0d6efd"/><rect x="46" y="55" width="8" height="8" fill="#0d6efd"/><rect x="62" y="55" width="8" height="8" fill="#0d6efd"/><rect x="44" y="68" width="12" height="12" fill="#0d6efd"/></svg>`)
            };
            this.resetAppState();
            segments.displaySegmentCards();
            setTimeout(() => {
                const customSegmentCard = document.querySelector(`[data-segment-key="${customKey}"]`);
                if (customSegmentCard) {
                    customSegmentCard.click();
                }
            }, 100);
            const modal = bootstrap.Modal.getInstance(document.getElementById('createCustomSegmentModal'));
            modal.hide();
            document.querySelectorAll('.demo-card').forEach(card => card.classList.remove('selected'));
            document.getElementById('personaGenerationSection').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        } catch (error) {
            console.error('Error creating custom segment:', error);
            ui.showError(`Error creating custom segment: ${error.message}`);
        }
    },

    resetAppState() {
        state.personas = [];
        state.surveyResults = [];
        state.surveyQuestions = [];
        state.surveyOptions = [];
        state.charts.forEach(chart => chart.destroy());
        state.charts = [];
        state.generatedCode = '';
        state.currentSegmentKey = "";
        state.colorScales = {};
        state.segmentPrompt = "";
        state.fieldsList = "";
        elements.personaCount.textContent = '0';
        elements.responseCount.textContent = '0';
        elements.generatedCode.textContent = '// Code will appear here...';
        elements.personaTableBody.innerHTML = '<tr><td>No personas generated yet</td></tr>';
        elements.surveyResultsMatrix.innerHTML = '<p class="text-muted small"><i class="bi bi-info-circle me-1"></i>Survey responses will appear here as a matrix...</p>';
        elements.chartsContainer.innerHTML = '<p class="text-muted small"><i class="bi bi-info-circle me-1"></i>Charts will appear here.</p>';
        elements.dynamicQuestionsContainer.innerHTML = '<p class="text-muted small p-3 text-center">No survey questions added yet. Click "Add Question" to start.</p>';
        ['generatedCodeSection', 'personasSection', 'surveySectionWrapper', 'resultsSectionWrapper'].forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) section.style.display = 'none';
        });
        ['executeCodeBtn', 'downloadPersonasBtn', 'runSurveyBtn', 'downloadSurveyCsvBtn', 'downloadResultsBtn'].forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.disabled = true;
        });
    },
    parseDemoQuestions(questionsText) {
        const questionLines = questionsText.split('\n').filter(line => line.trim());
        const surveyQuestions = [];
        const surveyOptions = [];
        for (let i = 0; i < questionLines.length; i++) {
            let question = questionLines[i].trim().replace(/\s+\?$/, '?');
            let options = [];
            const nextLine = questionLines[i + 1]?.trim();
            if (nextLine && /^\(.+\)$/.test(nextLine) && !/e\.g\./i.test(nextLine)) {
                options = nextLine.slice(1, -1).split(/\s*\/\s*/).map(opt => opt.trim()).filter(Boolean);
                i++;
            }
            surveyQuestions.push(question);
            surveyOptions.push(options);
        }
        return { surveyQuestions, surveyOptions };
    },
    applyConfigSettings(configSettings) {
        if (!configSettings) return;
        const settingsMappings = [['numPersonas', 'numPersonasValue'], ['surveyParticipants', 'surveyParticipantsValue']];
        settingsMappings.forEach(([setting, valueElement]) => {
            if (configSettings[setting]) {
                const element = document.getElementById(setting);
                const valueEl = document.getElementById(valueElement);
                if (element && valueEl) {
                    element.value = configSettings[setting];
                    valueEl.textContent = configSettings[setting];
                }
            }
        });
        ['personaModel', 'surveyModel'].forEach(modelType => {
            if (configSettings[modelType]) {
                const selectId = modelType === 'personaModel' ? 'modelSelect' : 'surveyModelSelect';
                const select = document.getElementById(selectId);
                if (select?.querySelector(`option[value="${configSettings[modelType]}"]`)) {
                    select.value = configSettings[modelType];
                }
            }
        });
    },
    updateUIForDemo() {
        elements.personaConfigSection.style.display = "block";
        if (state.generatedCode) {
            elements.generatedCode.textContent = state.generatedCode;
            elements.generatedCodeSection.style.display = 'block';
            document.getElementById('executeCodeBtn').disabled = false;
        }
        if (state.personas.length) {
            personas.displayPersonas();
            elements.personasSection.style.display = 'block';
            elements.surveySection.style.display = 'block';
            document.getElementById('downloadPersonasBtn').disabled = false;
            document.getElementById('runSurveyBtn').disabled = false;
        }
        
        results.generateColorScales();
        survey.renderDynamicQuestions();
        if (state.surveyResults.length) {
            results.renderOMRCMatrix();
            elements.responseCount.textContent = state.surveyResults.length.toString();
            ['downloadSurveyCsvBtn', 'downloadResultsBtn'].forEach(btnId => { document.getElementById(btnId).disabled = false; });
            elements.resultsSection.style.display = 'block';
            results.renderCharts();
        }
    },
    initializeDemoCards() {
        const demosContainer = document.getElementById('demos');
        if (!demosContainer) return;
        fetch('demos/demoFiles.json')
            .then(response => response.json())
            .then(demoFiles => {
                state.demoFiles = demoFiles;
                const demoCardsHtml = demoFiles.map(demo => `
                    <div class="col mb-4">
                        <div class="card h-100 demo-card" role="button" style="cursor: pointer;" data-file="${demo.file}">
                            <div class="card-body text-center">
                                <div class="d-flex justify-content-center align-items-center mb-3" style="gap: 0.5rem;">
                                    ${demo.images.map(img => `<img src="${img}" alt="${demo.title} segment icon" class="rounded-circle" style="width: 40px; height: 40px; object-fit: cover; border: 2px solid #eee;">`).join('')}
                                </div>
                                <h5 class="card-title">${demo.title}</h5>
                                <p class="card-text small text-muted">${demo.description || ''}</p>
                            </div>
                        </div>
                    </div>`).join('');
                demosContainer.innerHTML = demoCardsHtml;
                this.createCustomDemoCard();
            })
            .catch(error => console.error('Error loading demo files:', error));
    }
};

const handlers = {
    setupInputHandlers() {
        const rangeInputs = [['numPersonas', 'numPersonasValue'], ['surveyParticipants', 'surveyParticipantsValue']];
        rangeInputs.forEach(([inputId, valueId]) => {
            const input = document.getElementById(inputId);
            const valueDisplay = document.getElementById(valueId);
            if (input && valueDisplay) {
                input.addEventListener('input', utils.debounce(() => { valueDisplay.textContent = input.value; }, 100));
            }
        });
    },
    setupButtonHandlers() {
        const buttonHandlers = {
            'configureProviderBtn': () => config.configureLLMProvider(true),
            'generateCodeBtn': () => personas.generateCode(),
            'executeCodeBtn': () => personas.executeCode(),
            'saveSegmentChanges': () => segments.saveSegmentChanges(),
            'downloadPersonasBtn': () => utils.downloadCsv(state.personas, 'shell_synthetic_personas.csv', "No personas to download"),
            'runSurveyBtn': () => survey.runSurvey(),
            'downloadSurveyCsvBtn': () => utils.downloadCsv(state.surveyResults, 'shell_survey_results.csv', "No survey results to download"),
            'downloadResultsBtn': () => utils.downloadCsv(state.surveyResults, 'shell_complete_survey_results.csv', "No results to download"),
            'resetFiltersBtn': () => results.resetFilters(),
            'sidebar-toggle': () => ui.toggleSidebar(),
            'addQuestionBtn': () => survey.openQuestionModal(),
            'saveQuestionBtn': () => survey.saveQuestion(),
            'createCustomSegmentBtn': () => demo.createCustomSegment(), // NEW
        };
        Object.entries(buttonHandlers).forEach(([buttonId, handler]) => {
            const button = document.getElementById(buttonId);
            if (button) button.addEventListener('click', handler);
        });
    },
    setupCollapsibleToggles() {
        document.querySelectorAll('.collapsible-toggle').forEach(toggle => {
            toggle.addEventListener('click', function() { this.classList.toggle('collapsed'); });
        });
    },
    setupDynamicHandlers() {
    document.addEventListener('click', function(e) {
        const card = e.target.closest('.demo-card');
        if (card) {
            if (card.dataset.custom === 'true') {
                demo.openCustomSegmentModal();
                return;
            }
            const demoFile = card.getAttribute('data-file');
            if (demoFile) demo.loadDemoData(demoFile);
        }
    });
        elements.dynamicQuestionsContainer.addEventListener('click', e => {
            const editBtn = e.target.closest('.edit-question-btn');
            if (editBtn) {
                survey.openQuestionModal(parseInt(editBtn.dataset.index));
                return;
            }
            const removeBtn = e.target.closest('.remove-question-btn');
            if (removeBtn) {
                survey.removeQuestion(parseInt(removeBtn.dataset.index));
            }
        });
        const tooltipEl = document.querySelector('.tooltip');
        elements.surveyResultsMatrix.addEventListener('mouseover', e => {
            const dot = e.target.closest('.response-dot');
            if (dot && dot.dataset.tooltipContent) {
                tooltipEl.innerHTML = dot.dataset.tooltipContent;
                tooltipEl.style.opacity = 0.9;
                const tooltipWidth = tooltipEl.offsetWidth || 200;
                tooltipEl.style.left = `${e.pageX - tooltipWidth - 10}px`;
                tooltipEl.style.top = `${e.pageY - 28}px`;
            }
        });
        elements.surveyResultsMatrix.addEventListener('mouseout', e => {
            const dot = e.target.closest('.response-dot');
            if (dot) {
                tooltipEl.style.opacity = 0;
            }
        });
    }
};

function initializeApp() {
    utils.cacheElements();
    segments.loadSegmentData("segments.json", "shell");
    config.configureLLMProvider(false);
    questionModalInstance = new bootstrap.Modal(document.getElementById('questionModal'));
(async () => {
  try {
    const response = await fetch('demos/shell.json');
    const demoData = await response.json();
    const { surveyQuestions, surveyOptions } = demo.parseDemoQuestions(demoData.surveyQuestionsText || '');
    state.surveyQuestions = surveyQuestions;
    state.surveyOptions = surveyOptions;
    results.generateColorScales();
    survey.renderDynamicQuestions();
  } catch (error) {
    console.error("Failed to load Shell demo questions:", error);
  }
})();

    results.generateColorScales();
    survey.renderDynamicQuestions();
    ['generatedCodeSection', 'personasSection', 'surveySectionWrapper', 'resultsSectionWrapper'].forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) section.style.display = 'none';
    });
    handlers.setupInputHandlers();
    handlers.setupButtonHandlers();
    handlers.setupCollapsibleToggles();
    handlers.setupDynamicHandlers();
    demo.initializeDemoCards();
}
document.addEventListener('DOMContentLoaded', initializeApp);