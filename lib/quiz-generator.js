// Quiz Generator
// Uses Gemini to generate quizzes from learning content

async function generateQuizFromContent(content, title, apiKey) {
    console.log('🧠 Generating quiz from content...');
    
    if (!apiKey) {
        throw new Error('API key required for quiz generation');
    }

    const prompt = 'You are an expert educational assessment designer. Based on the following learning content, generate 3 challenging quiz questions that test comprehension and retention.\n\n' +
        'Content Title: ' + title + '\n\n' +
        'Content:\n' + content.substring(0, 3000) + '\n\n' +
        'Generate quiz questions that:\n' +
        '1. Test understanding of key concepts\n' +
        '2. Are moderately challenging\n' +
        '3. Have clear correct and incorrect answers\n' +
        '4. Are relevant to the content provided\n\n' +
        'IMPORTANT: Return ONLY valid JSON (no markdown, no code blocks) with this exact format:\n' +
        '{\n' +
        '  "questions": [\n' +
        '    {\n' +
        '      "question": "question text",\n' +
        '      "options": ["option a", "option b", "option c", "option d"],\n' +
        '      "correctAnswer": 0,\n' +
        '      "explanation": "why this answer is correct"\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        'Do not include any text before or after the JSON object.';

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Quiz generation failed');
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const responseText = data.candidates[0].content.parts[0].text;
            
            // Parse JSON response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid JSON response from Gemini');
            }
            
            const quiz = JSON.parse(jsonMatch[0]);
            console.log('✅ Quiz generated with ' + quiz.questions.length + ' questions');
            
            return quiz;
        }

        throw new Error('Unexpected response format from Gemini API');
    } catch (error) {
        console.error('❌ Quiz generation failed:', error);
        throw error;
    }
}

async function validateQuizAnswer(question, userAnswerIndex, apiKey) {
    console.log('🔍 Validating answer...');
    
    if (!apiKey) {
        throw new Error('API key required for answer validation');
    }

    const isCorrect = userAnswerIndex === question.correctAnswer;
    
    const prompt = 'You are a teacher grading a quiz answer.\n\n' +
        'Question: ' + question.question + '\n' +
        'Options:\n' +
        question.options.map((opt, i) => (i + 1) + '. ' + opt).join('\n') + '\n\n' +
        'Student selected: ' + (userAnswerIndex + 1) + '. ' + question.options[userAnswerIndex] + '\n' +
        'Correct answer: ' + (question.correctAnswer + 1) + '. ' + question.options[question.correctAnswer] + '\n\n' +
        'Provide brief feedback (1-2 sentences) about why this is ' + (isCorrect ? 'correct' : 'incorrect') + '.\n' +
        'Start with "Correct!" if right, or "Incorrect." if wrong.\n' +
        'Keep response under 50 words.';

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Answer validation failed');
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const feedback = data.candidates[0].content.parts[0].text;
            
            return {
                correct: isCorrect,
                feedback: feedback,
                correctAnswer: question.options[question.correctAnswer],
                explanation: question.explanation
            };
        }

        throw new Error('Unexpected response format from Gemini API');
    } catch (error) {
        console.error('❌ Answer validation failed:', error);
        throw error;
    }
}

export {
    generateQuizFromContent,
    validateQuizAnswer
};
