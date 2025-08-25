import os
import boto3
from botocore.exceptions import ClientError
import mimetypes
from pathlib import Path

# AWS 配置 - 使用环境变量
AWS_CONFIG = {
    'aws_access_key_id': os.environ.get('AWS_ACCESS_KEY_ID'),
    'aws_secret_access_key': os.environ.get('AWS_SECRET_ACCESS_KEY'),
    'region_name': os.environ.get('AWS_REGION', 'us-east-2'),
    'bucket_name': os.environ.get('AWS_BUCKET_NAME', 'zhilog1'),
    'prefix': os.environ.get('AWS_PREFIX', 'papers/')
}

# 本地文件目录
LOCAL_PDF_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'pdf')

def test_s3_connection():
    """测试 S3 连接"""
    try:
        s3_client = boto3.client(
            's3',
            aws_access_key_id=AWS_CONFIG['aws_access_key_id'],
            aws_secret_access_key=AWS_CONFIG['aws_secret_access_key'],
            region_name=AWS_CONFIG['region_name']
        )
        
        # 测试列出存储桶
        s3_client.head_bucket(Bucket=AWS_CONFIG['bucket_name'])
        print("✅ S3 连接测试成功！")
        return s3_client
    except ClientError as e:
        print(f"❌ S3 连接测试失败: {e}")
        return None

def migrate_files(s3_client):
    """迁移文件到 S3"""
    if not s3_client:
        return
    
    success_count = 0
    error_count = 0
    skipped_count = 0
    
    # 确保本地目录存在
    if not os.path.exists(LOCAL_PDF_DIR):
        print(f"❌ 本地目录不存在: {LOCAL_PDF_DIR}")
        return
    
    # 获取已有的 S3 文件列表
    try:
        existing_files = set()
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=AWS_CONFIG['bucket_name'], Prefix=AWS_CONFIG['prefix']):
            if 'Contents' in page:
                for obj in page['Contents']:
                    existing_files.add(obj['Key'])
    except ClientError as e:
        print(f"❌ 获取 S3 文件列表失败: {e}")
        return

    # 遍历本地文件
    for file_path in Path(LOCAL_PDF_DIR).glob('**/*'):
        if not file_path.is_file():
            continue
            
        relative_path = file_path.relative_to(LOCAL_PDF_DIR)
        s3_key = f"{AWS_CONFIG['prefix']}{relative_path}"
        
        # 检查文件是否已存在于 S3
        if s3_key in existing_files:
            print(f"⏭️ 跳过已存在文件: {relative_path}")
            skipped_count += 1
            continue
            
        try:
            # 获取文件类型
            content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
            
            # 上传文件
            print(f"⬆️ 上传: {relative_path}")
            with open(file_path, 'rb') as f:
                s3_client.upload_fileobj(
                    f,
                    AWS_CONFIG['bucket_name'],
                    s3_key,
                    ExtraArgs={
                        'ContentType': content_type,
                        'ACL': 'private'
                    }
                )
            success_count += 1
            
            # 测试生成预签名 URL
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': AWS_CONFIG['bucket_name'],
                    'Key': s3_key
                },
                ExpiresIn=3600
            )
            print(f"🔗 预签名 URL 生成成功: {url[:100]}...")
            
        except Exception as e:
            print(f"❌ 上传失败 {relative_path}: {e}")
            error_count += 1
    
    print(f"\n📊 迁移完成:")
    print(f"✅ 成功: {success_count}")
    print(f"❌ 失败: {error_count}")
    print(f"⏭️ 跳过: {skipped_count}")

def main():
    """主函数"""
    print("🚀 开始 S3 文件迁移...")
    
    # 检查环境变量
    if not AWS_CONFIG['aws_access_key_id'] or not AWS_CONFIG['aws_secret_access_key']:
        print("❌ 请设置 AWS_ACCESS_KEY_ID 和 AWS_SECRET_ACCESS_KEY 环境变量")
        return
    
    # 测试连接
    s3_client = test_s3_connection()
    if not s3_client:
        return
    
    # 执行迁移
    migrate_files(s3_client)

if __name__ == "__main__":
    main()
