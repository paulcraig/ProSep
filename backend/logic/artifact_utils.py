import fitz, json, time

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


PREVIEW_SIZE = (400, 300)
PREVIEW_DIR = Path('data/artifacts/.previews')
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

METADATA_FILE = Path('data/artifacts/.metadata.json')


class MetadataManager:
    '''
    Manages file metadata for upload order.
    '''
    
    @staticmethod
    def load() -> dict:
        if METADATA_FILE.exists():
            try:
                with open(METADATA_FILE, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    

    @staticmethod
    def save(metadata: dict) -> None:
        METADATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(METADATA_FILE, 'w') as f:
            json.dump(metadata, f, indent=2)
    

    @staticmethod
    def add_file(filename: str) -> None:
        metadata = MetadataManager.load()
        if filename not in metadata:
            metadata[filename] = {
                'upload_time': time.time(),
                'upload_order': len(metadata)
            }
            MetadataManager.save(metadata)
    

    @staticmethod
    def update_file(old_name: str, new_name: str) -> None:
        metadata = MetadataManager.load()
        if old_name in metadata:
            old_metadata = metadata.pop(old_name)
            metadata[new_name] = old_metadata
            MetadataManager.save(metadata)
        else:
            MetadataManager.add_file(new_name)
    

    @staticmethod
    def remove_file(filename: str) -> None:
        metadata = MetadataManager.load()
        if filename in metadata:
            metadata.pop(filename)
            MetadataManager.save(metadata)
    

    @staticmethod
    def get_files(files_dir: Path) -> list[dict]:
        files = []
        metadata = MetadataManager.load()
        
        for f in files_dir.iterdir():
            if f.is_file() and f.name not in ['.metadata.json', '.gitkeep']:
                file_meta = metadata.get(f.name, {})
                files.append({
                    'id': f.name,
                    'name': f.name,
                    'size': f.stat().st_size,
                    'url': f'/artifacts/{f.name}',
                    'upload_order': file_meta.get('upload_order', 999999),
                    'upload_time': file_meta.get('upload_time', 0)
                })
        
        files.sort(key=lambda x: x['upload_order'])
        return files
    

    @staticmethod
    def reorder_files(file_order: list[str]) -> None:
        metadata = MetadataManager.load()
        
        for index, filename in enumerate(file_order):
            if filename in metadata:
                metadata[filename]['upload_order'] = index
        
        MetadataManager.save(metadata)


class PreviewGenerator:
    '''
    Generates preview images for various file types (low-key sloppy).
    '''

    @staticmethod
    def generate(file_path: Path) -> Path:
        preview_path = PreviewGenerator.get_preview_path(file_path.name)
        
        if preview_path.exists():
            return preview_path
        
        suffix = file_path.suffix.lower()
        
        try:
            if suffix in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff']:
                return PreviewGenerator.__generate_image_preview(file_path, preview_path)
            
            elif suffix == '.pdf':
                return PreviewGenerator.__generate_pdf_preview(file_path, preview_path)
            
            elif suffix in ['.txt', '.md', '.json', '.xml', '.csv', '.log', '.py', '.js', '.html', '.css', '.fasta', '.faa']:
                return PreviewGenerator.__generate_text_preview(file_path, preview_path, suffix)
            
            elif suffix in ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']:
                return PreviewGenerator.__generate_office_preview(file_path, preview_path, suffix)
            
            else:
                return PreviewGenerator.__generate_generic_preview(file_path, preview_path)
                
        except Exception as e:
            print(f'Error generating preview for {file_path}: {e}')
            return PreviewGenerator.__generate_generic_preview(file_path, preview_path)
        

    @staticmethod
    def get_preview_path(filename: str) -> Path:
        return PREVIEW_DIR / f'{filename}.png'


    @staticmethod
    def delete(filename: str) -> None:
        preview_path = PreviewGenerator.get_preview_path(filename)
        if preview_path.exists():
            preview_path.unlink()
    

    @staticmethod
    def __generate_image_preview(file_path: Path, preview_path: Path) -> Path:
        with Image.open(file_path) as img:
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            img.thumbnail(PREVIEW_SIZE, Image.Resampling.LANCZOS)
            img.save(preview_path, 'PNG')
        
        return preview_path
    

    @staticmethod
    def __generate_pdf_preview(file_path: Path, preview_path: Path) -> Path:
        try:
            doc = fitz.open(file_path)
            page = doc[0]
            mat = fitz.Matrix(2, 2)

            if hasattr(page, 'get_pixmap'):
                pix = page.get_pixmap(matrix=mat)  # type: ignore
            else:
                pix = page.getPixmap(matrix=mat)  # type: ignore
            
            img = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            img.thumbnail(PREVIEW_SIZE, Image.Resampling.LANCZOS)
            img.save(preview_path, 'PNG')
            doc.close()
            
        except Exception as e:
            print(f'PDF preview error: {e}')
            return PreviewGenerator.__generate_generic_preview(file_path, preview_path, 'PDF')
        
        return preview_path
    

    @staticmethod
    def __generate_text_preview(file_path: Path, preview_path: Path, suffix: str) -> Path:
        img = Image.new('RGB', PREVIEW_SIZE, color=(30, 30, 40))
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 12)
            title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
        except:
            font = ImageFont.load_default()
            title_font = ImageFont.load_default()
        
        draw.text((10, 10), f'{suffix.upper()} File', fill=(200, 200, 255), font=title_font)
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()[:15]
                y = 40
                for line in lines:
                    line = line.rstrip()[:60]
                    draw.text((10, y), line, fill=(220, 220, 220), font=font)
                    y += 16
                    if y > PREVIEW_SIZE[1] - 20:
                        break
        except:
            draw.text((10, 40), 'Unable to read file', fill=(255, 100, 100), font=font)
        
        img.save(preview_path, 'PNG')
        return preview_path
    

    @staticmethod
    def __generate_office_preview(file_path: Path, preview_path: Path, suffix: str) -> Path:
        img = Image.new('RGB', PREVIEW_SIZE, color=(40, 50, 70))
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 24)
            small_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
        except:
            font = ImageFont.load_default()
            small_font = ImageFont.load_default()
        
        icons = {
            '.doc': ('📄', 'Word Document'),
            '.docx': ('📄', 'Word Document'),
            '.xls': ('📊', 'Excel Spreadsheet'),
            '.xlsx': ('📊', 'Excel Spreadsheet'),
            '.ppt': ('📽', 'PowerPoint'),
            '.pptx': ('📽', 'PowerPoint'),
        }
        
        icon, label = icons.get(suffix, ('📄', 'Document'))
        
        draw.text((PREVIEW_SIZE[0]//2 - 30, PREVIEW_SIZE[1]//2 - 40), icon, fill=(255, 255, 255), font=font)
        draw.text((PREVIEW_SIZE[0]//2 - 70, PREVIEW_SIZE[1]//2 + 10), label, fill=(200, 200, 200), font=small_font)
        draw.text((PREVIEW_SIZE[0]//2 - 70, PREVIEW_SIZE[1]//2 + 30), file_path.name, fill=(150, 150, 150), font=small_font)
        
        img.save(preview_path, 'PNG')
        return preview_path
    

    @staticmethod
    def __generate_generic_preview(file_path: Path, preview_path: Path, file_type: str | None = None) -> Path:
        img = Image.new('RGB', PREVIEW_SIZE, color=(50, 50, 60))
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
            small_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
        except:
            font = ImageFont.load_default()
            small_font = ImageFont.load_default()
        
        draw.text((PREVIEW_SIZE[0]//2 - 20, PREVIEW_SIZE[1]//2 - 40), '📎', fill=(180, 180, 180), font=font)
        display_type = file_type or file_path.suffix.upper().lstrip('.')
        draw.text((PREVIEW_SIZE[0]//2 - 60, PREVIEW_SIZE[1]//2 + 10), display_type or 'File', fill=(200, 200, 200), font=font)
        draw.text((PREVIEW_SIZE[0]//2 - 80, PREVIEW_SIZE[1]//2 + 40), file_path.name[:30], fill=(150, 150, 150), font=small_font)
        
        img.save(preview_path, 'PNG')
        return preview_path
