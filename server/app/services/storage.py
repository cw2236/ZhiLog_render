import os
import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
from typing import Optional, BinaryIO
import aiofiles
import logging

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.storage_type = os.getenv("STORAGE_TYPE", "local")
        self.upload_dir = os.getenv("UPLOAD_DIR", "uploads")
        
        if self.storage_type == "s3":
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "us-east-2")
            )
            self.bucket = os.getenv("S3_BUCKET_NAME")  # 修改这里以匹配环境变量
            self.prefix = os.getenv("AWS_S3_PREFIX", "papers/")
            self.presigned_expiry = int(os.getenv("AWS_S3_PRESIGNED_EXPIRY", "3600"))
            
            # 测试 S3 连接
            try:
                self.s3_client.head_bucket(Bucket=self.bucket)
                logger.info("Successfully connected to S3 bucket: %s", self.bucket)
            except ClientError as e:
                logger.error("Failed to connect to S3: %s", e)
                raise

    async def save_file(self, file: UploadFile, filename: str) -> str:
        """保存文件并返回文件路径或URL"""
        try:
            if self.storage_type == "s3":
                return await self._save_to_s3(file, filename)
            else:
                return await self._save_to_local(file, filename)
        except Exception as e:
            logger.error("Error saving file: %s", e)
            raise

    async def _save_to_s3(self, file: UploadFile, filename: str) -> str:
        """保存文件到S3"""
        key = f"{self.prefix}{filename}"
        try:
            content = await file.read()
            self.s3_client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=content,
                ContentType='application/pdf'
            )
            logger.info("Successfully uploaded file to S3: %s", key)
            return f"https://{self.bucket}.s3.{os.getenv('AWS_REGION', 'us-east-2')}.amazonaws.com/{key}"
        except Exception as e:
            logger.error("Error uploading to S3: %s", e)
            raise
        finally:
            await file.seek(0)

    async def _save_to_local(self, file: UploadFile, filename: str) -> str:
        """保存文件到本地"""
        if not os.path.exists(self.upload_dir):
            os.makedirs(self.upload_dir)
        
        file_path = os.path.join(self.upload_dir, filename)
        try:
            async with aiofiles.open(file_path, 'wb') as buffer:
                content = await file.read()
                await buffer.write(content)
            logger.info("Successfully saved file locally: %s", file_path)
            return filename
        except Exception as e:
            logger.error("Error saving file locally: %s", e)
            raise
        finally:
            await file.seek(0)

    async def get_file_url(self, file_path: str) -> str:
        """获取文件的URL"""
        if not file_path:
            raise ValueError("file_path cannot be empty")

        # 如果已经是完整的 URL，直接返回
        if file_path.startswith('http://') or file_path.startswith('https://'):
            return file_path

        if self.storage_type == "s3":
            # 对于 S3，返回公开可访问的 URL
            key = file_path if not file_path.startswith('/') else file_path[1:]
            return f"https://{self.bucket}.s3.{os.getenv('AWS_REGION', 'us-east-2')}.amazonaws.com/{key}"
        else:
            # 对于本地文件，返回相对路径
            return f"/static/pdf/{file_path}"

    async def delete_file(self, file_path: str) -> bool:
        """删除文件"""
        try:
            if self.storage_type == "s3":
                key = file_path if not file_path.startswith('/') else file_path[1:]
                self.s3_client.delete_object(
                    Bucket=self.bucket,
                    Key=key
                )
                logger.info("Successfully deleted file from S3: %s", key)
            else:
                full_path = os.path.join(self.upload_dir, file_path)
                if os.path.exists(full_path):
                    os.remove(full_path)
                    logger.info("Successfully deleted local file: %s", full_path)
            return True
        except Exception as e:
            logger.error("Error deleting file: %s", e)
            return False

# 全局存储服务实例
storage_service = StorageService() 