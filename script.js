// Global variables to store data
let personas = [];
let surveyResults = [];
let surveyQuestions = [];
let surveyOptions = [];
let charts = [];
let generatedCode = '';

// DOM elements and initialization
document.addEventListener('DOMContentLoaded', function() {
    const segmentSelect = document.getElementById('segmentSelect');
    const segmentPrompt = document.getElementById('segmentPrompt');
    const fieldsList = document.getElementById('fieldsList');

    let segmentData = {};

    // Load JSON file
    fetch('segments.json')
        .then(response => response.json())
        .then(data => {
            segmentData = data;

            // Populate default
            const selectedSegment = segmentData[segmentSelect.value];
            segmentPrompt.value = selectedSegment.description;
            fieldsList.value = selectedSegment.fields;

            // Handle segment changes
            segmentSelect.addEventListener('change', () => {
                const selectedSegment = segmentData[segmentSelect.value];
                segmentPrompt.value = selectedSegment.description;
                fieldsList.value = selectedSegment.fields;
            });
        })

    // Hide sections initially
    document.getElementById('generatedCodeSection').style.display = 'none';
    document.getElementById('personasSection').style.display = 'none';

    // Initialize sliders with their display values
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

    // Initialize model select dropdowns with options from template
    const modelTemplate = document.getElementById('modelOptionsTemplate');
    document.querySelectorAll('.model-select').forEach(select => {
        select.innerHTML = modelTemplate.innerHTML;
    });
        
    // Button event listeners
    document.getElementById('generateCodeBtn').addEventListener('click', async function() {
        await generatePersonaCode();
        document.getElementById('generatedCodeSection').style.display = 'block';
        // Scroll to generated code section
        document.getElementById('generatedCodeSection').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('executeCodeBtn').addEventListener('click', async function() {
        await executePersonaCode();
        document.getElementById('personasSection').style.display = 'block';
        // Scroll to personas section
        document.getElementById('personasSection').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('downloadPersonasBtn').addEventListener('click', () => {
    downloadCsv(personas, 'shell_synthetic_personas.csv', "No personas to download");});
    document.getElementById('nextToSurveyBtn').addEventListener('click', () => {
        document.querySelector('#mainTabs button[data-bs-target="#survey"]').click();
    });
    
    document.getElementById('runSurveyBtn').addEventListener('click', runSurvey);
    document.getElementById('downloadSurveyBtn').addEventListener('click', downloadSurveyJson);
    document.getElementById('downloadSurveyCsvBtn').addEventListener('click', () => {
    downloadCsv(surveyResults, 'shell_survey_results.csv', "No survey results to download");});
    document.getElementById('nextToResultsBtn').addEventListener('click', () => {
        document.querySelector('#mainTabs button[data-bs-target="#results"]').click();
        renderCharts();
    });
    
    document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);
    document.getElementById('downloadResultsBtn').addEventListener('click', () => {
    downloadCsv(surveyResults, 'shell_complete_survey_results.csv', "No results to download");});
});

// STEP 1: Generate Persona Code
async function generatePersonaCode() {
    try {
        const apiKey = document.getElementById('apiKeyInput').value;
        if (!apiKey) {
            showError("Please enter your OpenRouter API key");
            return;
        }
        
        const segmentPrompt = document.getElementById('segmentPrompt').value;
        const fieldsList = document.getElementById('fieldsList').value.split('\n').filter(line => line.trim() !== '');
        const numPersonas = parseInt(document.getElementById('numPersonas').value);
        const temperature = parseFloat(document.getElementById('personaTemperature').value);
        const model = document.getElementById('modelSelect').value;
        
        
        // Show progress indicator
        const progressBar = document.getElementById('generationProgress');
        progressBar.classList.remove('d-none');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBarInner.style.width = '50%';
        progressBarInner.textContent = 'Generating code...';
        
        // Prepare prompt for the LLM
        const prompt = `
        Write a JavaScript code to  generate REALISTIC fake data of ${numPersonas} rows of persona based on the following profile and fields provided

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
        
        // Call the API
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Shell Synthetic Persona Survey'
            },
            body: JSON.stringify({
                model: model,
                temperature: temperature,
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
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

        // Hide the progress bar after a short delay (optional)
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 1000); // hides after 1 second, adjust as needed
        
        // Enable execute button
        document.getElementById('executeCodeBtn').disabled = false;
        
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

        // Hide the progress bar after a short delay (optional)
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 1000); // hides after 1 second, adjust as needed
        
        // Display personas in the table
        displayPersonas();
        
        // Enable next steps
        document.getElementById('downloadPersonasBtn').disabled = false;
        document.getElementById('nextToSurveyBtn').disabled = false;
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
    
    // Clear previous values from global variables
    surveyQuestions = [];
    surveyOptions = [];

    questionLines.forEach(line => {
        let question = line.trim();
        let options = [];

        // Check for options in parentheses with or without italics: _(Options)_ or (Options)
        const parenthesesMatch = line.match(/[\(_]([^)]+)[\)_]/);
        if (parenthesesMatch) {
            // Extract options from parentheses
            const optionsText = parenthesesMatch[1].trim();
            options = optionsText.split(/\s*\/\s*|\s*,\s*/).map(opt => opt.trim()).filter(opt => opt);
            
            // Remove the options part from the question
            question = line.replace(/\s*[\(_]([^)]+)[\)_]\s*/, '').trim();
        } 
        // Check for question mark format
        else if (line.includes('?')) {
            const parts = line.split('?');
            question = parts[0].trim() + '?';
            
            // If there's content after the question mark, try to parse options
            if (parts.length >= 2) {
                const optionsText = parts.slice(1).join('?').trim();
                if (optionsText) {
                    options = optionsText.split(/\s*\/\s*|\s*,\s*/).map(opt => opt.trim()).filter(opt => opt);
                }
            }
        }
        // Check for colon format
        else if (line.includes(':')) {
            const colonParts = line.split(':');
            question = colonParts[0].trim();
            
            const optionsText = colonParts.slice(1).join(':').trim();
            if (optionsText) {
                options = optionsText.split(/\s*\/\s*|\s*,\s*/).map(opt => opt.trim()).filter(opt => opt);
            }
        }

        // Check for scale format (e.g., "1-5 scale" or "1–5 scale")
        const scaleMatch = line.match(/\(?\s*(\d+[\-–]\d+)\s+scale\s*\)?/i);
        if (scaleMatch) {
            const scaleParts = scaleMatch[1].split(/[\-–]/);
            const min = parseInt(scaleParts[0]);
            const max = parseInt(scaleParts[1]);
            
            // Generate options for the scale
            options = Array.from({length: max - min + 1}, (_, i) => (i + min).toString());
            
            // Clean up the question by removing the scale part
            question = line.replace(/\s*\(?\s*\d+[\-–]\d+\s+scale\s*\)?\s*/i, '').trim();
        }

        surveyQuestions.push(question);
        surveyOptions.push(options);
    });

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
        required: []
    };
    
    surveyQuestions.forEach((question, index) => {
        const questionId = `question_${index + 1}`;
        const options = surveyOptions[index];
        
        schema.properties[questionId] = {
            type: "string",
            description: question,
            enum: options
        };
        
        schema.required.push(questionId);
    });
    
    // Display the schema
    const jsonSchemaDisplay = document.getElementById('jsonSchemaDisplay');
    jsonSchemaDisplay.textContent = JSON.stringify(schema, null, 2);
    
    return schema;
}

async function runSurvey() {
    try {
        if (personas.length === 0) {
            showError("Please generate personas first");
            return;
        }
        
        const apiKey = document.getElementById('apiKeyInput').value;
        if (!apiKey) {
            showError("Please enter your OpenRouter API key");
            return;
        }
        
        // Parse survey questions and generate schema
        const { surveyQuestions: questions, surveyOptions: options } = parseQuestions();
        surveyQuestions = questions; // Update global variable
        surveyOptions = options; // Update global variable
        
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
        
        // Show progress
        const progressBar = document.getElementById('surveyProgress');
        progressBar.classList.remove('d-none');
        const progressBarInner = progressBar.querySelector('.progress-bar');
        progressBarInner.style.width = '0%';
        progressBarInner.textContent = 'Starting survey...';
        
        // Disable the run button during survey
        document.getElementById('runSurveyBtn').disabled = true;
        
        // Clear previous results
        surveyResults = [];
        document.getElementById('surveyResultsPreview').innerHTML = '';
        document.getElementById('responseCount').textContent = '0';
        
        // Process each participant
        for (let i = 0; i < participants.length; i++) {
            const persona = participants[i];
            
            // Update progress
            const progress = Math.round(((i + 1) / participants.length) * 100);
            progressBarInner.style.width = `${progress}%`;
            progressBarInner.textContent = `Processed ${i + 1} of ${participants.length} (${progress}%)`;

            if(i==participants.length-1){
                setTimeout(() => {
                        progressBar.style.display = 'none';
                }, 1000); // hides after 1 second, adjust as needed
            }
            
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
            
            // Call the API
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'HTTP-Referer': window.location.href,
                    'X-Title': 'Shell Synthetic Persona Survey'
                },
                body: JSON.stringify({
                    model: model,
                    temperature: temperature,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: `Please answer the following survey questions. Respond in JSON format according to the provided schema:\n\n${JSON.stringify(schema, null, 2)}\n\nQuestions:\n${questionsPrompt}` }
                    ],
                    response_format: { type: "json_object" }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error for participant ${i+1}: ${errorData.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            const content = data.choices[0].message.content;
            
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
                    console.warn(`Could not parse JSON for participant ${i+1}. Skipping.`);
                    continue;
                }
            }
            
            // Combine persona data with survey responses
            const result = {
                participant_id: i + 1,
                ...persona,
                ...answerData
            };
            
            surveyResults.push(result);
            
            // Update response count
            document.getElementById('responseCount').textContent = surveyResults.length.toString();
            
            const resultsPreview = document.getElementById('surveyResultsPreview');
            const resultDiv = document.createElement('div');
            resultDiv.className = 'card mb-2';
            resultDiv.innerHTML = `
                <div class="card-header bg-light">
                    Participant ${i + 1}
                </div>
                <div class="card-body">
                    <pre style="font-size: 12px;">${JSON.stringify(answerData, null, 2)}</pre>
                </div>
            `;
            resultsPreview.appendChild(resultDiv);
        }
        
        // Re-enable the run button
        document.getElementById('runSurveyBtn').disabled = false;
        
        // Enable next steps
        document.getElementById('downloadSurveyBtn').disabled = false;
        document.getElementById('downloadSurveyCsvBtn').disabled = false;
        document.getElementById('nextToResultsBtn').disabled = false;
        document.getElementById('downloadResultsBtn').disabled = false;
        
    } catch (error) {
        console.error("Error running survey:", error);
        showError(`Error running survey: ${error.message}`);
        document.getElementById('runSurveyBtn').disabled = false;
        const progressBar = document.getElementById('surveyProgress');
        progressBar.classList.add('d-none');
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

function downloadSurveyJson() {
    if (surveyResults.length === 0) {
        showError("No survey results to download");
        return;
    }
    
    // Create and trigger download
    const jsonContent = JSON.stringify(surveyResults, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'shell_survey_results.json');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    
    // Get question keys (assuming they follow the pattern question_1, question_2, etc.)
    const questionKeys = Object.keys(surveyResults[0]).filter(key => key.startsWith('question_'));
    
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
        chartCol.className = 'col-md-6 mb-4';
        
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
    
    // Get all persona fields (excluding survey questions)
    const personaFields = Object.keys(surveyResults[0]).filter(key => !key.startsWith('question_') && key !== 'participant_id');
    
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
    
    // Get question keys
    const questionKeys = Object.keys(filteredResults[0]).filter(key => key.startsWith('question_'));
    
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
            td.textContent = result[field];
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