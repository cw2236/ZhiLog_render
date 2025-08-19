"""
Simplified LLM client for metadata extraction.
"""
import json
import logging
import os
import re
import io
import asyncio
import openai
from typing import Optional, Type, TypeVar, Dict, Any, Callable

from pydantic import BaseModel

from src.schemas import (
    PaperMetadataExtraction,
    TitleAuthorsAbstract,
    InstitutionsKeywords,
    SummaryAndCitations,
    StarterQuestions,
    Highlights,
)
from src.utils import retry_llm_operation, time_it

logger = logging.getLogger(__name__)

# Constants
DEFAULT_CHAT_MODEL = "openai.gpt-4o-mini"
FAST_CHAT_MODEL = "openai.gpt-4o-mini"

# Pydantic model type variable
T = TypeVar("T", bound=BaseModel)


SYSTEM_INSTRUCTIONS = """
You are a metadata extraction assistant. Your task is to extract specific information from the provided academic paper content. Pay special attention to the details and ensure accuracy in the extracted metadata.

Always think step-by-step when making a determination with respect to the contents of the paper. If you are unsure about a specific field, provide a best guess based on the content available.

You will be rewarded for your accuracy and attention to detail. You are helping to facilitate humanity's understanding of scientific knowledge by delivering accurate and reliable metadata extraction.
"""

# LLM Prompts
EXTRACT_METADATA_PROMPT_TEMPLATE = """
You are a metadata extraction assistant. Your task is to extract specific information from the provided academic paper content.

Please extract the following fields and structure them in a JSON format according to the provided schema.

Schema: {schema}
"""

SYSTEM_INSTRUCTIONS_IMAGE_CAPTION = """
You are an image captioning assistant for academic papers. Your task is to extract exact captions for images.

Return only the caption text with no additional commentary or explanations.

Rules:
- For figures, graphs, or charts: Return the exact caption from the paper
- Return an empty string if the image is:
  • Not a graph, chart, or figure
  • Not useful for understanding the paper
  • A partial portion of a larger figure, thus not a standalone or complete figure
  • Has no caption and is not useful for understanding the paper
"""


class JSONParser:

    @staticmethod
    def validate_and_extract_json(json_data: str) -> dict:
        """Extract and validate JSON data from various formats"""
        if not json_data or not isinstance(json_data, str):
            raise ValueError("Invalid input: empty or non-string data")

        json_data = json_data.strip()

        # Case 1: Try parsing directly first
        try:
            return json.loads(json_data)
        except json.JSONDecodeError:
            pass

        # Case 2: Check for code block format
        if "```" in json_data:
            code_blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)```", json_data)

            for block in code_blocks:
                block = block.strip()
                block = re.sub(r"}\s+\w+\s+}", "}}", block)
                block = re.sub(r"}\s+\w+\s+,", "},", block)

                try:
                    return json.loads(block)
                except json.JSONDecodeError:
                    continue

        raise ValueError(
            "Could not extract valid JSON from the provided string. "
            "Please ensure the response contains proper JSON format."
        )


class AsyncLLMClient:
    """
    A simple LLM client for metadata extraction using OpenAI.
    """

    def __init__(
        self,
        api_key: str,
        default_model: Optional[str] = None,
    ):
        self.api_key = api_key
        self.default_model: str = default_model or DEFAULT_CHAT_MODEL
        self.client: Optional[openai.AsyncOpenAI] = None

    def refresh_client(self):
        """Refresh the LLM client with the current API key."""
        if not self.api_key:
            raise ValueError("API key is not set")
        self.client = openai.AsyncOpenAI(
            api_key=self.api_key,
            base_url="https://api.ai.it.cornell.edu/v1"  # Use Cornell's API endpoint
        )

    async def generate_content(
        self,
        prompt: str,
        image_bytes: Optional[bytes] = None,
        image_mime_type: Optional[str] = None,
        cache_key: Optional[str] = None,
        model: Optional[str] = None
    ) -> str:
        """Generate content using OpenAI API."""
        if not self.client:
            self.refresh_client()

        messages = [
            {"role": "system", "content": SYSTEM_INSTRUCTIONS},
            {"role": "user", "content": prompt}
        ]

        # Add image if provided
        if image_bytes:
            import base64
            # Encode image bytes to base64
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            messages[1]["content"] = [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{image_mime_type};base64,{image_base64}"
                    }
                }
            ]

        try:
            response = await self.client.chat.completions.create(
                model=model or self.default_model,
                messages=messages,
                temperature=0.1,
                max_tokens=4000
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"Error generating content: {e}")
            raise


class PaperOperations(AsyncLLMClient):
    """Operations for paper metadata extraction."""

    def __init__(self, api_key: str, default_model: Optional[str] = None):
        super().__init__(api_key, default_model)

    async def _extract_single_metadata_field(
        self,
        model: Type[T],
        paper_content: str,
        status_callback: Callable[[str], None],
        cache_key: Optional[str] = None,
    ) -> T:
        """Extract a single metadata field using the provided model."""
        if not self.client:
            self.refresh_client()

        # Create the prompt with the model's schema
        schema = model.model_json_schema()
        prompt = EXTRACT_METADATA_PROMPT_TEMPLATE.format(schema=json.dumps(schema, indent=2))
        prompt += f"\n\nPaper content:\n{paper_content[:8000]}"  # Limit content length

        try:
            response = await self.generate_content(prompt)
            json_data = JSONParser.validate_and_extract_json(response)
            return model(**json_data)
        except Exception as e:
            logger.error(f"Error extracting metadata field: {e}")
            # Return a default instance if extraction fails
            if model == TitleAuthorsAbstract:
                return TitleAuthorsAbstract(title="", authors=[], abstract="", publish_date=None)
            elif model == InstitutionsKeywords:
                return InstitutionsKeywords(institutions=[], keywords=[])
            elif model == SummaryAndCitations:
                return SummaryAndCitations(summary="", summary_citations=[])
            elif model == StarterQuestions:
                return StarterQuestions(starter_questions=[])
            elif model == Highlights:
                return Highlights(highlights=[])
            else:
                return model()

    @retry_llm_operation(max_retries=3, delay=1.0)
    async def extract_title_authors_abstract(
        self,
        paper_content: str,
        status_callback: Callable[[str], None],
        cache_key: Optional[str] = None,
    ) -> TitleAuthorsAbstract:
        """Extract title, authors, and abstract from paper content."""
        status_callback("Extracting title, authors, and abstract...")
        return await self._extract_single_metadata_field(
            TitleAuthorsAbstract, paper_content, status_callback, cache_key
        )

    @retry_llm_operation(max_retries=3, delay=1.0)
    async def extract_institutions_keywords(
        self,
        paper_content: str,
        status_callback: Callable[[str], None],
        cache_key: Optional[str] = None,
    ) -> InstitutionsKeywords:
        """Extract institutions and keywords from paper content."""
        status_callback("Extracting institutions and keywords...")
        return await self._extract_single_metadata_field(
            InstitutionsKeywords, paper_content, status_callback, cache_key
        )

    @retry_llm_operation(max_retries=3, delay=1.0)
    async def extract_summary_and_citations(
        self,
        paper_content: str,
        status_callback: Callable[[str], None],
        cache_key: Optional[str] = None,
    ) -> SummaryAndCitations:
        """Extract summary and citations from paper content."""
        status_callback("Extracting summary and citations...")
        return await self._extract_single_metadata_field(
            SummaryAndCitations, paper_content, status_callback, cache_key
        )

    @retry_llm_operation(max_retries=3, delay=1.0)
    async def extract_starter_questions(
        self,
        paper_content: str,
        status_callback: Callable[[str], None],
        cache_key: Optional[str] = None,
    ) -> StarterQuestions:
        """Extract starter questions from paper content."""
        status_callback("Extracting starter questions...")
        return await self._extract_single_metadata_field(
            StarterQuestions, paper_content, status_callback, cache_key
        )

    @retry_llm_operation(max_retries=3, delay=1.0)
    async def extract_highlights(
        self,
        paper_content: str,
        status_callback: Callable[[str], None],
        cache_key: Optional[str] = None,
    ) -> Highlights:
        """Extract highlights from paper content."""
        status_callback("Extracting highlights...")
        return await self._extract_single_metadata_field(
            Highlights, paper_content, status_callback, cache_key
        )

    async def extract_paper_metadata(
        self,
        paper_content: str,
        job_id: str,
        status_callback: Optional[Callable[[str], None]] = None,
    ) -> PaperMetadataExtraction:
        """Extract all paper metadata concurrently."""
        if not self.client:
            self.refresh_client()

        def default_status_callback(status: str):
            logger.info(f"Job {job_id}: {status}")

        if status_callback is None:
            status_callback = default_status_callback

        status_callback("Starting: Extracting paper metadata from LLM...")

        try:
            # Run all metadata extraction tasks concurrently
            status_callback("Starting: Running all metadata extraction tasks concurrently...")
            
            tasks = [
                self.extract_title_authors_abstract(paper_content, status_callback),
                self.extract_institutions_keywords(paper_content, status_callback),
                self.extract_summary_and_citations(paper_content, status_callback),
                self.extract_starter_questions(paper_content, status_callback),
                self.extract_highlights(paper_content, status_callback),
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Handle any exceptions and create default values if needed
            title_authors_abstract = results[0] if not isinstance(results[0], Exception) else TitleAuthorsAbstract(title="", authors=[], abstract="", publish_date=None)
            institutions_keywords = results[1] if not isinstance(results[1], Exception) else InstitutionsKeywords(institutions=[], keywords=[])
            summary_and_citations = results[2] if not isinstance(results[2], Exception) else SummaryAndCitations(summary="", summary_citations=[])
            starter_questions = results[3] if not isinstance(results[3], Exception) else StarterQuestions(starter_questions=[])
            highlights = results[4] if not isinstance(results[4], Exception) else Highlights(highlights=[])

            # Log any exceptions
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Error in metadata extraction task {i}: {result}")

            metadata = PaperMetadataExtraction(
                title=title_authors_abstract.title,
                authors=title_authors_abstract.authors,
                abstract=title_authors_abstract.abstract,
                institutions=institutions_keywords.institutions,
                keywords=institutions_keywords.keywords,
                summary=summary_and_citations.summary,
                summary_citations=summary_and_citations.summary_citations,
                publish_date=title_authors_abstract.publish_date,
                starter_questions=starter_questions.starter_questions,
                highlights=highlights.highlights,
            )

            status_callback("Finished: Extracting paper metadata from LLM.")
            return metadata

        except Exception as e:
            logger.error(f"Error extracting paper metadata: {e}")
            # Return a default metadata object with all required fields
            return PaperMetadataExtraction(
                title="",
                authors=[],
                abstract="",
                institutions=[],
                keywords=[],
                summary="",
                summary_citations=[],
                publish_date=None,
                starter_questions=[],
                highlights=[]
            )

    async def extract_image_captions(
        self,
        cache_key: Optional[str],
        image_data: bytes,
        image_mime_type: Optional[str] = None,
    ) -> str:
        """Extract captions from images using OpenAI Vision."""
        if not self.client:
            self.refresh_client()

        try:
            response = await self.generate_content(
                "Please extract the caption for this image from the academic paper. Return only the caption text with no additional commentary.",
                image_bytes=image_data,
                image_mime_type=image_mime_type or "image/jpeg"
            )
            return response.strip()
        except Exception as e:
            logger.error(f"Error extracting image caption: {e}")
            return ""


# Global LLM client instance
def get_llm_client() -> PaperOperations:
    """Get the global LLM client instance."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")

    return PaperOperations(api_key=api_key)


# For backward compatibility
fast_llm_client = get_llm_client
