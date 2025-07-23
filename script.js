import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
let personas = [];
let surveyResults = [];
let surveyQuestions = [];
let surveyOptions = [];
let charts = [];
let generatedCode = '';
let segmentData = {};
let currentSegmentKey = "segment1";
let llmConfig = null; 
async function configureLLMProvider() {
    try {
        llmConfig = await openaiConfig({
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
            show: true 
        });
        updateProviderStatus();
        updateModelOptions();
        return llmConfig;
    } catch (error) {
        showError(`Provider configuration failed: ${error.message}`);
    }
}
// Update provider status display
function updateProviderStatus() {
    const statusElement = document.getElementById('providerStatus');
    if (llmConfig && llmConfig.baseURL && llmConfig.apiKey) {
        statusElement.innerHTML = `<i class="bi bi-check-circle text-success me-1"></i>Connected to Provider`;
        statusElement.className = 'provider-status text-success';
    } else {
        statusElement.innerHTML = '<i class="bi bi-exclamation-circle me-1"></i>No provider configured';
        statusElement.className = 'provider-status text-muted';
    }
}

function updateModelOptions() {
    const personaModelSelect = document.getElementById('modelSelect');
    const surveyModelSelect = document.getElementById('surveyModelSelect');

    if (llmConfig && llmConfig.models && Array.isArray(llmConfig.models) && llmConfig.models.length > 0) {
        personaModelSelect.innerHTML = '';
        surveyModelSelect.innerHTML = '';

        const modelsList = llmConfig.models.map(model => {
            if (typeof model === 'string') {
                return { id: model, name: model };
            } else if (typeof model === 'object' && model !== null) {
                return {
                    id: model.id || model.name || model.model || String(model),
                    name: model.name || model.id || model.model || String(model)
                };
            } else {
                console.warn('Unknown model format:', model);
                return { id: String(model), name: String(model) };
            }
        }).filter(model => model.id);

        console.log('Processed models list:', modelsList);

        // Fill personaModelSelect with all models
        modelsList.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            personaModelSelect.appendChild(option);
        });

        // Only include specific survey models (exact match)
        const preferredSurveyModels = ['gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o-mini'];
        const modelsToUse = modelsList.filter(model =>
            preferredSurveyModels.includes(model.id)
        );

        modelsToUse.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name;
            surveyModelSelect.appendChild(option);
        });

        console.log(`Loaded ${modelsList.length} models for persona generation, ${modelsToUse.length} for surveys`);
    }
}

// Initialize LLM configuration on page load
async function initializeLLMConfig() {
    try {
        llmConfig = await openaiConfig({
            defaultBaseUrls: [
                "https://llmfoundry.straivedemo.com/openai/v1",
                "https://llmfoundry.straive.com/openai/v1", 
                "https://aipipe.org/api/v1",
                "https://openrouter.com/api/v1",
                "https://api.openai.com/v1"
            ],
            show: false // Don't force show modal, only show if not configured
        });
        updateProviderStatus();
        updateModelOptions();
    } catch (error) {
        console.warn("No LLM provider configured yet:", error.message);
        updateProviderStatus();
        updateModelOptions(); // This will load fallback models
    }
}
// Make API call using configured provider
async function makeAPICall(messages, model, temperature = 1, responseFormat = null) {
    if (!llmConfig || !llmConfig.baseURL || !llmConfig.apiKey) {throw new Error("API Error");}
    const requestBody = { model: model,temperature: temperature,messages: messages};
    if (responseFormat) {requestBody.response_format = responseFormat;}
    const response = await fetch(`${llmConfig.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json','Authorization': `Bearer ${llmConfig.apiKey}`,
            'HTTP-Referer': window.location.href,'X-Title': 'Synthetic Persona Survey'},
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
}
function loadSegmentData(fileName, categoryKey) {
    fetch(fileName)
        .then(response => response.json())
        .then(data => {
            segmentData = data[categoryKey];
            const segmentSelect = document.getElementById("segmentSelect");
            segmentSelect.innerHTML = "";
            for (const key in segmentData) {
                const option = document.createElement("option");
                option.value = key;
                option.textContent = segmentData[key].name;
                segmentSelect.appendChild(option);
            }
            currentSegmentKey = segmentSelect.value;
            updateSegmentFields(currentSegmentKey);
            segmentSelect.addEventListener("change", () => {
                currentSegmentKey = segmentSelect.value;
                updateSegmentFields(currentSegmentKey);
            });
        })
        .catch(error => {
            console.error("Error loading segment data:", error);
        });
}
function updateSegmentFields(segmentKey) {
    const selectedSegment = segmentData[segmentKey];
    document.getElementById("segmentPrompt").value = selectedSegment.description;
    document.getElementById("fieldsList").value = selectedSegment.fields;
}

document.addEventListener('DOMContentLoaded', function() {
    loadSegmentData("segments.json", "shell");
    initializeLLMConfig();
    document.getElementById('generatedCodeSection').style.display = 'none';
    document.getElementById('personasSection').style.display = 'none';
    document.getElementById('numPersonas').addEventListener('input', function() {
        document.getElementById('numPersonasValue').textContent = this.value;
    });
    document.getElementById('personaTemperature').addEventListener('input', function() {
        document.getElementById('personaTemperatureValue').textContent = this.value;
    });
    document.getElementById('surveyParticipants').addEventListener('input', function() {
        document.getElementById('surveyParticipantsValue').textContent = this.value;
    });
    document.getElementById('surveyTemperature').addEventListener('input', function() {
        document.getElementById('surveyTemperatureValue').textContent = this.value;
    });
    document.getElementById('configureProviderBtn').addEventListener('click', configureLLMProvider);
    
    // Button event listeners
    document.getElementById('generateCodeBtn').addEventListener('click', generatePersonaCode);
    document.getElementById('executeCodeBtn').addEventListener('click', executePersonaCode);
    document.getElementById('downloadPersonasBtn').addEventListener('click', () => {
        downloadCsv(personas, 'shell_synthetic_personas.csv', "No personas to download");
    });
    
    document.getElementById('runSurveyBtn').addEventListener('click', runSurvey);
    document.getElementById('downloadSurveyCsvBtn').addEventListener('click', () => {
        downloadCsv(surveyResults, 'shell_survey_results.csv', "No survey results to download");
    });
    
    document.getElementById('downloadResultsBtn').addEventListener('click', () => {
        downloadCsv(surveyResults, 'shell_complete_survey_results.csv', "No results to download");
    });
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
});
// STEP 1: Generate Persona Code
async function generatePersonaCode() {
    try {
        if (!llmConfig || !llmConfig.baseURL || !llmConfig.apiKey) {
            showError("Please configure your API provider first");
            return;
        }
        
        const segmentPrompt = document.getElementById('segmentPrompt').value;
        const fieldsList = document.getElementById('fieldsList').value.split('\n').filter(line => line.trim() !== '');
        const numPersonas = parseInt(document.getElementById('numPersonas').value);
        const temperature = parseFloat(document.getElementById('personaTemperature').value);
        const model = document.getElementById('modelSelect').value;
        
        // Show progress indicator
        const progressBar = document.getElementById('generationProgress');
        progressBar.style.display = 'flex';
        progressBar.classList.remove('d-none');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBarInner.style.width = '50%';
        progressBarInner.textContent = 'Generating code...';
        
        // Prepare prompt for the LLM
        const prompt = `
        Write a JavaScript code to generate REALISTIC fake data of ${numPersonas} rows of persona based on the following profile and fields provided
        When listing possible values for fields, go beyond the examples above to be FULLY comprehensive.
        When picking values, use realistic distributions for each value based on real-life.
        <PROFILE>
        ${segmentPrompt}
        </PROFILE>
        <FIELDS>
        These are the fields I need for each persona:
        ${fieldsList.join('\n')}
        </FIELDS>
        
        Please provide ONLY JavaScript code that:
        1. Defines a function called generatePersonas() that returns an array of ${numPersonas} persona objects
        2. Creates realistic, diverse data that matches the segment profile
        3. Properly uses randomization to create natural distributions of values
        4. Returns the data as an array of JSON objects, with each field as a key-value pair
        The returned code should be ready to execute in a browser environment. 
        DO NOT include any explanation text outside the JavaScript code itself.
        `;
        
        // Call the API using the configured provider
        const content = await makeAPICall([
            { role: "user", content: prompt }
        ], model, temperature);
        
        // Extract code from response
        let code = content;
        
        // Check if the response is wrapped in backticks or has JS markdown
        const codeMatch = content.match(/```javascript\s*([\s\S]*?)\s*```/) || 
                          content.match(/```js\s*([\s\S]*?)\s*```/) || 
                          content.match(/```\s*([\s\S]*?)\s*```/);
        
        if (codeMatch) {
            code = codeMatch[1];
        }
        
        // Display the code
        generatedCode = code;
        document.getElementById('generatedCode').textContent = code;
        
        // Update progress
        progressBarInner.style.width = '100%';
        progressBarInner.textContent = 'Code generated';
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 1000);
        
        // Enable execute button
        document.getElementById('executeCodeBtn').disabled = false;
        
        // Show the generated code section
        document.getElementById('generatedCodeSection').style.display = 'block';
        document.getElementById('generatedCodeSection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error("Error generating code:", error);
        showError(`Error generating code: ${error.message}`);
        const progressBar = document.getElementById('generationProgress');
        progressBar.classList.add('d-none');
    }
}
function executePersonaCode() {
    try {
        // Show progress
        const progressBar = document.getElementById('generationProgress1');
        progressBar.style.display = 'flex';
        progressBar.classList.remove('d-none');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBarInner.style.width = '50%';
        progressBarInner.textContent = 'Executing code...';
        
        // Clear any previous personas
        personas = [];
        
        // Create a safe function execution environment
        const executeCode = new Function(`
            try {
                ${generatedCode}
                return { success: true, result: generatePersonas() };
            } catch (error) {
                return { success: false, error: error.message };
            }
        `);
        
        // Execute the code
        const result = executeCode();
        
        if (!result.success) {
            throw new Error(`Code execution failed: ${result.error}`);
        }
        
        // Update personas with the result
        personas = result.result;
        
        if (!Array.isArray(personas) || personas.length === 0) {
            throw new Error("Code execution did not return an array of personas");
        }
        
        // Update progress
        progressBarInner.style.width = '100%';
        progressBarInner.textContent = `${personas.length} personas generated`;
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 1000);
        
        // Display personas in the table
        displayPersonas();
        
        // After successful execution
        document.getElementById('downloadPersonasBtn').disabled = false;
        document.getElementById('personasSection').style.display = 'block';
        document.getElementById('personasSection').scrollIntoView({ behavior: 'smooth' });
        
        // Show and enable survey section
        const surveySection = document.getElementById('surveySection');
        surveySection.style.display = 'block';
        document.getElementById('runSurveyBtn').disabled = false;
        
    } catch (error) {
        console.error("Error executing code:", error);
        showError(`Error executing code: ${error.message}`);
        const progressBar = document.getElementById('generationProgress1');
        progressBar.classList.add('d-none');
    }
}
function displayPersonas() {
    if (personas.length === 0) {
        return;
    }
    
    const tableHeader = document.getElementById('personaTableHeader');
    const tableBody = document.getElementById('personaTableBody');
    const personaCount = document.getElementById('personaCount');
    
    // Update persona count
    personaCount.textContent = personas.length;
    
    // Clear existing content
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Add header row
    const fields = Object.keys(personas[0]);
    fields.forEach(field => {
        const th = document.createElement('th');
        th.textContent = field;
        tableHeader.appendChild(th);
    });
    
    // Add data rows
    personas.forEach((persona, index) => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-index', index);
        
        fields.forEach(field => {
            const td = document.createElement('td');
            td.textContent = persona[field];
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    });
}
function downloadCsv(data, filename, errorMessage) {
    if (!data || data.length === 0) {
        showError(errorMessage || "No data to download");
        return;
    }
    
    const fields = Object.keys(data[0]);
    const csvContent = [
        fields.join(','), // Header row
        ...data.map(item => 
            fields.map(field => {
                // Properly escape CSV values
                let value = item[field] || '';
                // Convert to string if it's not already
                if (typeof value !== 'string') {
                    value = String(value);
                }
                // If value contains commas, quotes, or newlines, wrap in quotes
                if (/[",\n\r]/.test(value)) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
// STEP 2: Run Survey
function parseQuestions() {
    const questionsText = document.getElementById('surveyQuestions').value;
    const questionLines = questionsText.split('\n').filter(line => line.trim() !== '');
    const surveyQuestions = [];
    const surveyOptions = [];
    
    for (let i = 0; i < questionLines.length; i++) {
        let question = questionLines[i].trim();
        let options = [];
        let nextLine = questionLines[i+1] && questionLines[i+1].trim();
        let optionsMatched = false;
        
        question = question.replace(/\s+\?$/, '?');
        
        if (nextLine && /^\(.+\)$/.test(nextLine) && !/e\.g\./i.test(nextLine)) {
            const optionsText = nextLine.slice(1, -1).trim();
            options = optionsText.split(/\s*\/\s*/).map(opt => opt.trim()).filter(Boolean);
            optionsMatched = true;
        }
        
        surveyQuestions.push(question);
        surveyOptions.push(options);
        
        if (optionsMatched) i++; 
    }
    
    return { surveyQuestions, surveyOptions };
}
function generateJsonSchema() {
    const { surveyQuestions, surveyOptions } = parseQuestions();
    
    if (surveyQuestions.length === 0) {
        showError("Please enter valid survey questions");
        return null;
    }
    
    // Create a JSON schema
    const schema = {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false
    };
    
    surveyQuestions.forEach((question, index) => {
        const questionId = `question_${index + 1}`;
        const options = surveyOptions[index];
        
        schema.properties[questionId] = {
            type: "string",
            description: question,
            enum: options
        };
        
        // Add reasoning field
        schema.properties[`${questionId}_reasoning`] = {
            type: "string",
            description: `Reasoning for ${question}`
        };
        
        // Add both to required fields
        schema.required.push(questionId);
        schema.required.push(`${questionId}_reasoning`);
    });
    
    // Display the schema
    const jsonSchemaDisplay = document.getElementById('jsonSchemaDisplay');
    jsonSchemaDisplay.textContent = JSON.stringify(schema, null, 2);
    
    return schema;
}
// Process a batch of participants
async function processBatch(participants, batchIndex, model, temperature, schema) {
    try {
        const batchResults = [];
        
        // Process each participant in this batch
        for (let i = 0; i < participants.length; i++) {
            const persona = participants[i];
            const participantIndex = batchIndex * participants.length + i;
            
            // Create a system prompt describing the persona
            const personaDescription = Object.entries(persona)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
            
            const systemPrompt = `You are a survey participant with the following profile:\n${personaDescription}\n\n
Your task is to answer survey questions authentically as this specific person would respond.
IMPORTANT: Your profile should strongly influence your choices. Different personas should have different preferences.
- People with different backgrounds and values will naturally choose different options
- Don't pick what you think is objectively "best" - pick what YOUR CHARACTER would choose
- Be true to the psychological traits, values, and background of your persona`;
            
            // Create questions prompt
            const questionsPrompt = surveyQuestions.map((q, idx) => 
                `${q} (Choose one: ${surveyOptions[idx].join(', ')})`
            ).join('\n\n');
            
            // Build structured response format
            const responseFormat = {
                type: "json_schema",
                json_schema: {
                    name: "surveyResponse",
                    strict: true,
                    schema: schema
                }
            };
            
            // Call the API using the configured provider
            const content = await makeAPICall([
                { role: "system", content: systemPrompt },
                { role: "user", content: `Please answer the following survey questions by choosing one of the options(enum). For each answer, provide a detailed reasoning explaining WHY you selected that option based on your persona's characteristics. you must respond with valid JSON only, that must use double quotes for all keys and string values, include commas between all key-value pairs, contain no trailing commas with no extra text or markdown outside the JSON object, it must have same keys that is defined in the schema, include all required fields.\n\n Questions:\n${questionsPrompt}` }
            ], model, temperature, responseFormat);
            
            // Parse the JSON response
            let answerData;
            try {
                answerData = JSON.parse(content);
            } catch (e) {
                // If direct parsing fails, try to extract JSON from the response
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    answerData = JSON.parse(jsonMatch[0]);
                } else {
                    console.warn(`Could not parse JSON for participant ${participantIndex+1}. Skipping.`);
                    continue;
                }
            }
            
            // Combine persona data with survey responses
            const result = {
                participant_id: participantIndex + 1,
                ...persona,
                ...answerData
            };
            
            batchResults.push(result);
        }
        
        return batchResults;
    } catch (error) {
        console.error(`Error processing batch ${batchIndex + 1}:`, error);
        throw error;
    }
}
// Modified runSurvey function
async function runSurvey() {
    try {
        if (personas.length === 0) {
            showError("Please generate personas first");
            return;
        }
        
        if (!llmConfig || !llmConfig.baseURL || !llmConfig.apiKey) {
            showError("Please configure your API provider first");
            return;
        }
        
        // Parse survey questions and generate schema
        const { surveyQuestions: questions, surveyOptions: options } = parseQuestions();
        surveyQuestions = questions;
        surveyOptions = options;
        
        const schema = generateJsonSchema();
        if (!schema) return;
        
        const numParticipants = Math.min(
            parseInt(document.getElementById('surveyParticipants').value),
            personas.length
        );
        const temperature = parseFloat(document.getElementById('surveyTemperature').value);
        const model = document.getElementById('surveyModelSelect').value;
        
        // Select random participants without duplicates
        const selectedIndices = selectRandomIndices(personas.length, numParticipants);
        const participants = selectedIndices.map(index => personas[index]);
        
        // Show progress bar
        const progressBar = document.getElementById('surveyProgress');
        progressBar.classList.remove('d-none');
        progressBar.style.display = 'block';
        
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBarInner.style.width = '5%';
        progressBarInner.textContent = 'Starting survey...';
        
        // Force a layout recalculation to ensure the progress bar appears
        void progressBar.offsetHeight;
        
        // Disable the run button during survey
        document.getElementById('runSurveyBtn').disabled = true;
        
        // Clear previous results
        surveyResults = [];
        document.getElementById('surveyResultsPreview').innerHTML = '';
        document.getElementById('responseCount').textContent = '0';
        
        // Divide participants into batches (5 batches)
        const BATCH_COUNT = 5;
        const batchSize = Math.ceil(participants.length / BATCH_COUNT);
        const batches = [];
        
        for (let i = 0; i < BATCH_COUNT; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, participants.length);
            if (start < participants.length) {
                batches.push(participants.slice(start, end));
            }
        }
        
        console.log(`Processing ${participants.length} participants in ${batches.length} batches of approximately ${batchSize} each`);
        
        // Process all batches in parallel
        const batchPromises = batches.map((batch, index) => 
            processBatch(batch, index, model, temperature, schema)
        );
        
        // Create a progress updater
        let completedParticipants = 0;
        const totalParticipants = participants.length;
        
        // Improved progress tracking
        progressBarInner.style.width = '10%';
        progressBarInner.textContent = `Waiting for first responses...`;
        document.getElementById('responseCount').textContent = '0';
        
        // Update progress as batches complete
        const progressUpdater = setInterval(() => {
            if (completedParticipants === 0) {
                const simulatedProgress = Math.min(30, parseInt(progressBarInner.style.width) + 1);
                progressBarInner.style.width = `${simulatedProgress}%`;
                progressBarInner.textContent = `Processing requests...`;
            } else {
                const progress = Math.round((completedParticipants / totalParticipants) * 100);
                progressBarInner.style.width = `${progress}%`;
                progressBarInner.textContent = `Processed ${completedParticipants} of ${totalParticipants} (${progress}%)`;
                document.getElementById('responseCount').textContent = completedParticipants.toString();
            }
        }, 200);
        
        // Track batch completion
        const processedResults = [];
        for (let i = 0; i < batches.length; i++) {
            try {
                const batchResult = await batchPromises[i];
                processedResults.push(...batchResult);
                completedParticipants += batchResult.length;
                
                // Update progress with actual values
                const progress = Math.round((completedParticipants / totalParticipants) * 100);
                progressBarInner.style.width = `${progress}%`;
                progressBarInner.textContent = `Processed ${completedParticipants} of ${totalParticipants} (${progress}%)`;
                document.getElementById('responseCount').textContent = completedParticipants.toString();
                
                console.log(`Completed batch ${i+1}/${batches.length} with ${batchResult.length} results`);
            } catch (error) {
                console.error(`Error in batch ${i+1}:`, error);
            }
        }
        
        clearInterval(progressUpdater);
        
        // Combine and sort results by participant_id
        surveyResults = processedResults.sort((a, b) => a.participant_id - b.participant_id);
        
        // Update the UI with results
        completedParticipants = surveyResults.length;
        progressBarInner.style.width = '100%';
        progressBarInner.textContent = `Processed ${completedParticipants} of ${totalParticipants} (100%)`;
        document.getElementById('responseCount').textContent = completedParticipants.toString();
        
        // Display results in the preview
        const resultsPreview = document.getElementById('surveyResultsPreview');
        resultsPreview.innerHTML = '';
        
        surveyResults.forEach((result, index) => {
            // Extract just the answer portion for display
            const answerData = {};
            Object.keys(result).forEach(key => {
                if (key.startsWith('question_') && !key.includes('_reasoning')) {
                    answerData[key] = result[key];
                }
            });
            
            const resultDiv = document.createElement('div');
            resultDiv.className = 'card mb-2';
            resultDiv.innerHTML = `
                <div class="card-header bg-light">
                    Participant ${result.participant_id}
                </div>
                <div class="card-body">
                    <pre style="font-size: 12px;">${JSON.stringify(answerData, null, 2)}</pre>
                </div>
            `;
            resultsPreview.appendChild(resultDiv);
        });
        
        // Hide progress bar after completion
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 1000);
        
        // Re-enable the run button
        document.getElementById('runSurveyBtn').disabled = false;
        
        // Enable download buttons
        document.getElementById('downloadSurveyCsvBtn').disabled = false;
        
        // Show and scroll to results section
        const resultsSection = document.getElementById('resultsSection');
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        document.getElementById('downloadResultsBtn').disabled = false;
        
        // Render charts
        renderCharts();
        
    } catch (error) {
        console.error("Error running survey:", error);
        showError(`Error running survey: ${error.message}`);
        document.getElementById('runSurveyBtn').disabled = false;
        
        // Make sure to hide the progress bar on error
        const progressBar = document.getElementById('surveyProgress');
        progressBar.style.display = 'none';
    }
}
function selectRandomIndices(max, count) {
    // Function to randomly select 'count' indices from 0 to max-1 without duplicates
    const indices = Array.from({ length: max }, (_, i) => i);
    
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // Take the first 'count' elements
    return indices.slice(0, count);
}
// STEP 3: Results Analysis and Visualization
function renderCharts() {
    if (surveyResults.length === 0) {
        showError("No survey results to display");
        return;
    }
    
    // Make sure we have the questions and options properly defined
    if (surveyQuestions.length === 0 || surveyOptions.length === 0) {
        // If not already defined, try to parse them from the form
        const { surveyQuestions: questions, surveyOptions: options } = parseQuestions();
        surveyQuestions = questions;
        surveyOptions = options;
    }
    
    // Clear existing charts
    const chartsContainer = document.getElementById('chartsContainer');
    chartsContainer.innerHTML = '';
    charts.forEach(chart => chart.destroy());
    charts = [];
    
    // Get question keys (excluding reasoning fields)
    const questionKeys = Object.keys(surveyResults[0])
        .filter(key => key.startsWith('question_') && !key.includes('_reasoning'));
    
    // Create charts for each question
    questionKeys.forEach((questionKey, index) => {
        // Get the question text
        const questionText = surveyQuestions[index];
        
        // Count responses for each option
        const responses = {};
        surveyResults.forEach(result => {
            const answer = result[questionKey];
            responses[answer] = (responses[answer] || 0) + 1;
        });
        
        // Create a column in the charts container
        const chartCol = document.createElement('div');
        chartCol.className = 'mb-4';
        
        // Create a card for the chart
        const chartCard = document.createElement('div');
        chartCard.className = 'card h-100';
        
        // Create card header with question text
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header';
        cardHeader.textContent = questionText;
        
        // Create card body for the chart
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        
        // Create canvas for Chart.js
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${questionKey}`;
        
        // Add elements to the DOM
        cardBody.appendChild(canvas);
        chartCard.appendChild(cardHeader);
        chartCard.appendChild(cardBody);
        chartCol.appendChild(chartCard);
        chartsContainer.appendChild(chartCol);
        
        // Create the chart
        const ctx = canvas.getContext('2d');
        const options = surveyOptions[index];
        
        // Ensure options are in the same order as defined in the survey
        const chartData = options.map(option => responses[option] || 0);
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: options,
                datasets: [{
                    label: 'Responses',
                    data: chartData,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)'
                    ],
                    borderColor: [
                        'rgb(255, 99, 132)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Responses'
                        }
                    }
                }
            }
        });
        
        charts.push(chart);
    });
    
    // Generate filter controls and data table
    generateFilters();
    populateResultsTable();
}
function generateFilters() {
    if (surveyResults.length === 0) return;
    
    const filterControls = document.getElementById('filterControls');
    filterControls.innerHTML = '';
    
    // Get all persona fields (excluding survey questions and reasoning fields)
    const personaFields = Object.keys(surveyResults[0]).filter(key => 
        !key.startsWith('question_') && key !== 'participant_id'
    );
    
    // Create filter dropdowns for categorical fields
    personaFields.forEach(field => {
        // Get unique values for this field
        const uniqueValues = [...new Set(surveyResults.map(result => result[field]))];
        
        // Skip fields with too many unique values or numeric IDs
        if (uniqueValues.length > 15 || field === 'ID') return;
        
        // Create filter control
        const filterCol = document.createElement('div');
        filterCol.className = 'mb-3';
        
        const filterLabel = document.createElement('label');
        filterLabel.className = 'form-label';
        filterLabel.textContent = field;
        filterLabel.setAttribute('for', `filter-${field}`);
        
        const filterSelect = document.createElement('select');
        filterSelect.className = 'form-select filter-control';
        filterSelect.id = `filter-${field}`;
        filterSelect.setAttribute('data-field', field);
        
        // Add "All" option
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All';
        filterSelect.appendChild(allOption);
        
        // Add options for each unique value
        uniqueValues.sort().forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            filterSelect.appendChild(option);
        });
        
        // Add change event listener
        filterSelect.addEventListener('change', applyFilters);
        
        // Add to filter controls
        filterCol.appendChild(filterLabel);
        filterCol.appendChild(filterSelect);
        filterControls.appendChild(filterCol);
    });
}
function applyFilters() {
    // Get all filter controls
    const filterControls = document.querySelectorAll('.filter-control');
    
    // Build filter criteria
    const filters = {};
    filterControls.forEach(control => {
        const field = control.getAttribute('data-field');
        const value = control.value;
        
        if (value !== 'all') {
            filters[field] = value;
        }
    });
    
    // Apply filters to results
    const filteredResults = surveyResults.filter(result => {
        return Object.entries(filters).every(([field, value]) => {
            return result[field] === value;
        });
    });
    
    // Update charts with filtered data
    updateCharts(filteredResults);
    
    // Update table with filtered data
    populateResultsTable(filteredResults);
}
function updateCharts(filteredResults) {
    if (!filteredResults || filteredResults.length === 0) {
        showError("No results match the selected filters");
        return;
    }
    
    // Get question keys (excluding reasoning fields)
    const questionKeys = Object.keys(filteredResults[0])
        .filter(key => key.startsWith('question_') && !key.includes('_reasoning'));
    
    // Update each chart with new data
    questionKeys.forEach((questionKey, index) => {
        // Count responses for each option
        const responses = {};
        filteredResults.forEach(result => {
            const answer = result[questionKey];
            responses[answer] = (responses[answer] || 0) + 1;
        });
        
        // Make sure options exist for this question
        if (!surveyOptions[index] || surveyOptions[index].length === 0) {
            console.warn(`No options found for question ${index + 1}`);
            return;
        }
        
        // Get options for this question
        const options = surveyOptions[index];
        
        // Update chart data
        const chartData = options.map(option => responses[option] || 0);
        
        // Update the chart
        const chart = charts[index];
        if (chart) {
            chart.data.datasets[0].data = chartData;
            chart.update();
        }
    });
}
function resetFilters() {
    // Reset all filter controls to "All"
    const filterControls = document.querySelectorAll('.filter-control');
    filterControls.forEach(control => {
        control.value = 'all';
    });
    
    // Apply filters (which will now be empty)
    applyFilters();
}
function populateResultsTable(data = null) {
    const tableData = data || surveyResults;
    if (tableData.length === 0) return;
    
    const tableHeader = document.getElementById('resultsTableHeader');
    const tableBody = document.getElementById('resultsTableBody');
    
    // Clear existing content
    tableHeader.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Get all fields
    const fields = Object.keys(tableData[0]);
    
    // Add header row
    fields.forEach(field => {
        const th = document.createElement('th');
        th.textContent = field;
        tableHeader.appendChild(th);
    });
    
    // Add data rows
    tableData.forEach(result => {
        const tr = document.createElement('tr');
        
        fields.forEach(field => {
            const td = document.createElement('td');
            
            // Truncate reasoning fields in the UI display
            if (field.includes('_reasoning')) {
                const fullText = result[field] || '';
                // Only truncate if the text is longer than 50 characters
                if (fullText.length > 50) {
                    const truncatedText = fullText.substring(0, 50) + '...';
                    td.textContent = truncatedText;
                    
                    // Store the full text as a data attribute for CSV export
                    td.setAttribute('data-full-text', fullText);
                    
                    // Optional: Add a tooltip to show the full text on hover
                    td.title = fullText;
                } else {
                    td.textContent = fullText;
                }
            } else {
                td.textContent = result[field];
            }
            
            tr.appendChild(td);
        });
        
        tableBody.appendChild(tr);
    });
}
// Utility functions
function showError(message) {
    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    document.getElementById('errorModalBody').textContent = message;
    errorModal.show();
}
// Function to load demo data
async function loadDemoData(demoFile) {
    try {
        const segmentKey = demoFile.split('/').pop().replace('.json', '');
        console.log("segmentKey", segmentKey);
        loadSegmentData("segments.json", segmentKey);
        // Show loading indicator
        document.getElementById('demoLoadingSpinner').classList.remove('d-none');
        
        // Fetch the demo data file
        const response = await fetch(demoFile);
        if (!response.ok) {
            throw new Error(`Failed to load demo file: ${response.statusText}`);
        }
        
        const demoData = await response.json();
        
        // Populate form fields with demo data
        document.getElementById('segmentPrompt').value = demoData.segmentPrompt || '';
        document.getElementById('fieldsList').value = demoData.fieldsList || '';
        document.getElementById('surveyQuestions').value = demoData.surveyQuestionsText || '';
        
        // Set slider values if they exist
        if (demoData.configSettings) {
            if (demoData.configSettings.numPersonas) {
                document.getElementById('numPersonas').value = demoData.configSettings.numPersonas;
                document.getElementById('numPersonasValue').textContent = demoData.configSettings.numPersonas;
            }
            if (demoData.configSettings.personaTemperature) {
                document.getElementById('personaTemperature').value = demoData.configSettings.personaTemperature;
                document.getElementById('personaTemperatureValue').textContent = demoData.configSettings.personaTemperature;
            }
            if (demoData.configSettings.surveyParticipants) {
                document.getElementById('surveyParticipants').value = demoData.configSettings.surveyParticipants;
                document.getElementById('surveyParticipantsValue').textContent = demoData.configSettings.surveyParticipants;
            }
            if (demoData.configSettings.surveyTemperature) {
                document.getElementById('surveyTemperature').value = demoData.configSettings.surveyTemperature;
                document.getElementById('surveyTemperatureValue').textContent = demoData.configSettings.surveyTemperature;
            }
            
            // Set model selections if they exist
            if (demoData.configSettings.personaModel) {
                const personaModelSelect = document.getElementById('modelSelect');
                if (personaModelSelect.querySelector(`option[value="${demoData.configSettings.personaModel}"]`)) {
                    personaModelSelect.value = demoData.configSettings.personaModel;
                }
            }
            if (demoData.configSettings.surveyModel) {
                const surveyModelSelect = document.getElementById('surveyModelSelect');
                if (surveyModelSelect.querySelector(`option[value="${demoData.configSettings.surveyModel}"]`)) {
                    surveyModelSelect.value = demoData.configSettings.surveyModel;
                }
            }
        }
        
        // Set global variables
        generatedCode = demoData.generatedCode || '';
        personas = demoData.personas || [];
        surveyResults = demoData.surveyResults || [];
        surveyQuestions = demoData.surveyQuestions || [];
        surveyOptions = demoData.surveyOptions || [];
        
        // Display the generated code if available
        if (generatedCode) {
            document.getElementById('generatedCode').textContent = generatedCode;
            document.getElementById('generatedCodeSection').style.display = 'block';
            document.getElementById('executeCodeBtn').disabled = false;
        }
        
        // Display personas if available
        if (personas.length > 0) {
            displayPersonas();
            document.getElementById('personasSection').style.display = 'block';
            document.getElementById('downloadPersonasBtn').disabled = false;
            
            // Show survey section
            document.getElementById('surveySection').style.display = 'block';
            document.getElementById('runSurveyBtn').disabled = false;
        }
        
        // Display survey results if available
        if (surveyResults.length > 0) {
            // Show survey section
            document.getElementById('surveySection').style.display = 'block';
            
            // Generate JSON schema
            generateJsonSchema();
            
            // Display results in the preview
            const resultsPreview = document.getElementById('surveyResultsPreview');
            resultsPreview.innerHTML = '';
            
            surveyResults.forEach((result) => {
                // Extract just the answer portion for display
                const answerData = {};
                Object.keys(result).forEach(key => {
                    if (key.startsWith('question_') && !key.includes('_reasoning')) {
                        answerData[key] = result[key];
                    }
                });
                
                const resultDiv = document.createElement('div');
                resultDiv.className = 'card mb-2';
                resultDiv.innerHTML = `
                    <div class="card-header bg-light">
                        Participant ${result.participant_id}
                    </div>
                    <div class="card-body">
                        <pre style="font-size: 12px;">${JSON.stringify(answerData, null, 2)}</pre>
                    </div>
                `;
                resultsPreview.appendChild(resultDiv);
            });
            
            document.getElementById('responseCount').textContent = surveyResults.length.toString();
            document.getElementById('downloadSurveyCsvBtn').disabled = false;
            
            // Show results section
            document.getElementById('resultsSection').style.display = 'block';
            document.getElementById('downloadResultsBtn').disabled = false;
            
            // Render charts
            renderCharts();
        }
        
        // Scroll to the top of the page
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        console.log('Demo data loaded successfully');
        
    } catch (error) {
        console.error('Error loading demo data:', error);
        showError(`Error loading demo: ${error.message}`);
    } finally {
        // Hide loading indicator
        document.getElementById('demoLoadingSpinner').classList.add('d-none');
    }
}
// Function to initialize demo cards
function initializeDemoCards() {
    const demosContainer = document.getElementById('demos');
    if (!demosContainer) return;
    
    fetch('demos/demoFiles.json')
      .then(response => response.json())
      .then(demoFiles => {
        demoFiles.forEach(demo => {
          const demoCard = document.createElement('div');
          demoCard.className = 'col mb-4';
          demoCard.innerHTML = `
            <div class="card h-100 demo-card" role="button" style="cursor: pointer;" data-file="${demo.file}">
              <div class="card-body text-center">
                <i class="${demo.icon} fs-1 mb-3 text-primary"></i>
                <h5 class="card-title">${demo.title}</h5>
              </div>
            </div>
          `;
          demosContainer.appendChild(demoCard);
        });
      });
    
    document.addEventListener('click', function (e) {
        const card = e.target.closest('.demo-card');
        if (!card) return;
        const demoFile = card.getAttribute('data-file');
        if (demoFile) {
            loadDemoData(demoFile);
        }
    });
}
// Initialize demos when DOM is loaded  
document.addEventListener('DOMContentLoaded', function() {
    initializeDemoCards();
    
    // Add a button to toggle demos visibility
    const demoToggleBtn = document.getElementById('demoToggleBtn');
    if (demoToggleBtn) {
        demoToggleBtn.addEventListener('click', () => {
            const demosSection = document.getElementById('demosSection');
            if (demosSection.style.display === 'none') {
                demosSection.style.display = 'block';
                demoToggleBtn.innerHTML = '<i class="bi bi-chevron-up me-1"></i>Hide Demos';
            } else {
                demosSection.style.display = 'none';
                demoToggleBtn.innerHTML = '<i class="bi bi-chevron-down me-1"></i>Show Demos';
            }
        });
    }
});