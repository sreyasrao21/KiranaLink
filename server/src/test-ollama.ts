// @ts-ignore
import { Ollama } from 'ollama';

const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });

async function test() {
    console.log('Testing Ollama connection...');
    try {
        const list = await ollama.list();
        console.log('Ollama is connected. Available models:', list.models.map((m: any) => m.name));

        console.log('Testing generation with llama3...');
        const response = await ollama.chat({
            model: 'llama3',
            messages: [{ role: 'user', content: 'Say hello in JSON format like {"msg": "hello"}' }],
            format: 'json',
            stream: false
        });
        console.log('Generation success:', response.message.content);
    } catch (error) {
        console.error('Ollama test failed:', error);
    }
}

test();
