"""
S3 service for file uploads and management.
"""
import logging
import os
import boto3
from botocore.exceptions import ClientError
from typing import Tuple

logger = logging.getLogger(__name__)

class S3Service:
    """Service for handling S3 file operations"""

    def __init__(self):
        """Initialize S3 service"""
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-2")
        )
        self.bucket = os.getenv("S3_BUCKET_NAME")  # 修改这里以匹配环境变量
        self.prefix = os.getenv("AWS_S3_PREFIX", "papers/")
        
        # Test S3 connection
        try:
            self.s3_client.head_bucket(Bucket=self.bucket)
            logger.info("Successfully connected to S3 bucket: %s", self.bucket)
        except ClientError as e:
            logger.error("Failed to connect to S3: %s", e)
            raise

    async def upload_any_file_from_bytes(
        self,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
    ) -> Tuple[str, str]:
        """Upload a file from bytes to S3

        Args:
            file_bytes (bytes): The file content as bytes
            original_filename (str): The original filename
            content_type (str): The MIME type of the file

        Returns:
            tuple[str, str]: The file ID and S3 URL
        """
        try:
            # Generate S3 key
            file_key = f"{self.prefix}{original_filename}"
            
            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=file_key,
                Body=file_bytes,
                ContentType=content_type
            )
            
            # 返回直接的 S3 URL
            file_url = f"https://{self.bucket}.s3.{os.getenv('AWS_REGION', 'us-east-2')}.amazonaws.com/{file_key}"
            
            logger.info(f"Uploaded file to S3: {file_key}")
            return file_key, file_url
            
        except Exception as e:
            logger.error(f"Error uploading file to S3: {e}")
            raise

    async def upload_any_file(
        self, file_path: str, original_filename: str, content_type: str
    ) -> tuple[str, str]:
        """
        Upload any file to S3
        Args:
            file_path: The path to the file to upload
            original_filename: The original name of the file
            content_type: The MIME type of the file
        Returns:
            tuple: File key and S3 URL
        """
        try:
            logger.info(f"Uploading file {original_filename} to S3")
            
            # Read file bytes
            with open(file_path, "rb") as file_obj:
                file_bytes = file_obj.read()
            
            return await self.upload_any_file_from_bytes(file_bytes, original_filename, content_type)
            
        except Exception as e:
            logger.error(f"Error uploading file to S3: {e}")
            raise

    async def delete_file(self, file_key: str) -> bool:
        """
        Delete a file from S3

        Args:
            file_key: The S3 key to delete

        Returns:
            bool: True if deleted successfully, False otherwise
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket,
                Key=file_key
            )
            logger.info(f"Deleted file from S3: {file_key}")
            return True
        except Exception as e:
            logger.error(f"Error deleting file from S3: {e}")
            return False

# Create a single instance to use throughout the application
s3_service = S3Service()
