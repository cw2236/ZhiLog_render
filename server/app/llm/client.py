import os
from typing import Optional
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

class LLMClient:
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        self.client = AsyncOpenAI(api_key=self.api_key)

    async def generate_content(self, prompt: str) -> str:
        try:
            response = await self.client.chat.completions.create(
                model="openai.gpt-4o",
                messages=[
                    {"role": "system", "content": """I am a professional research assistant, helping users understand academic papers. 
Please format your responses in clean, readable Markdown:

- Use headers (##) for main sections
- Use bullet points or numbered lists for structured information
- Use **bold** for emphasis on key terms
- Use > for important quotes or highlights
- Break down complex information into digestible sections
- Keep paragraphs concise and well-organized

Provide clear and concise answers in English."""},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"OpenAI API call failed: {str(e)}")

_llm_client: Optional[LLMClient] = None

def get_llm_client() -> LLMClient:
    global _llm_client
    if _llm_client is None:
        _llm_client = LLMClient()
    return _llm_client 