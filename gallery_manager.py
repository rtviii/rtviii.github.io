import os
import re
from pathlib import Path
import json
from typing import Dict, List, Optional, Tuple
from PIL import Image

class GalleryManager:
    def __init__(self, image_dir: str, qmd_file: str):
        self.image_dir = Path(image_dir)
        self.qmd_file = Path(qmd_file)
        self.metadata_file = self.image_dir / 'metadata.json'
        self.metadata = self.load_metadata()
        
    def load_metadata(self) -> Dict:
        """Load existing metadata or create new if doesn't exist"""
        if self.metadata_file.exists():
            with open(self.metadata_file, 'r') as f:
                return json.load(f)
        return {}
    
    def save_metadata(self):
        """Save metadata to JSON file"""
        with open(self.metadata_file, 'w') as f:
            json.dump(self.metadata, f, indent=2, sort_keys=True)
    
    def get_image_dimensions(self, image_path: Path) -> Tuple[int, int]:
        """Get dimensions of an image file"""
        with Image.open(image_path) as img:
            return img.size
    
    def determine_layout_class(self, width: int, height: int) -> str:
        """Determine whether image should be wide or tall based on dimensions"""
        aspect_ratio = width / height
        if aspect_ratio >= 1.5:  # Significantly wider than tall
            return 'wide'
        elif aspect_ratio <= 0.67:  # Significantly taller than wide
            return 'tall'
        return ''  # Default - no special class
    
    def scan_images(self) -> List[str]:
        """Scan image directory for image files and update metadata with dimensions"""
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif'}
        image_files = []
        
        for f in self.image_dir.glob('**/*'):
            if f.suffix.lower() in image_extensions:
                image_name = f.name
                image_files.append(image_name)
                
                # Update metadata if image not analyzed yet
                if image_name not in self.metadata or 'layout_class' not in self.metadata[image_name]:
                    try:
                        width, height = self.get_image_dimensions(f)
                        layout_class = self.determine_layout_class(width, height)
                        
                        # Create or update metadata entry
                        if image_name not in self.metadata:
                            self.metadata[image_name] = {}
                        
                        self.metadata[image_name].update({
                            'width': width,
                            'height': height,
                            'layout_class': layout_class,
                            'dimensions_analyzed': True
                        })
                    except Exception as e:
                        print(f"Error processing {image_name}: {e}")
        
        self.save_metadata()
        return image_files
    
    def parse_qmd(self) -> List[str]:
        """Parse QMD file to find already included images"""
        with open(self.qmd_file, 'r') as f:
            content = f.read()
        return re.findall(r'!\[.*?\]\((.*?)\)', content)
    
    def get_new_images(self) -> List[str]:
        """Find images that aren't yet in the QMD file"""
        existing_images = {Path(p).name for p in self.parse_qmd()}
        all_images = set(self.scan_images())
        return list(all_images - existing_images)
    
    def add_description(self, image: str, description: str):
        """Add or update image description in metadata"""
        if image not in self.metadata:
            self.metadata[image] = {}
        self.metadata[image]['description'] = description
        self.save_metadata()
    
    def generate_markdown(self, image: str) -> str:
        """Generate markdown for an image with appropriate layout class"""
        metadata = self.metadata.get(image, {})
        description = metadata.get('description', '')
        layout_class = metadata.get('layout_class', '')
        
        class_attr = f"{{.{layout_class}}}" if layout_class else ""
        return f'![{description}](./img/gallery/{image}){class_attr}\n\n'
    
    def generate_new_entries(self) -> str:
        """Generate markdown entries for new images"""
        new_images = self.get_new_images()
        return '\n'.join(self.generate_markdown(img) for img in new_images)
    
    def print_image_stats(self):
        """Print statistics about the images and their layout classes"""
        total = len(self.metadata)
        wide = sum(1 for meta in self.metadata.values() if meta.get('layout_class') == 'wide')
        tall = sum(1 for meta in self.metadata.values() if meta.get('layout_class') == 'tall')
        normal = total - wide - tall
        
        print(f"Image Statistics:")
        print(f"Total images: {total}")
        print(f"Wide images: {wide}")
        print(f"Tall images: {tall}")
        print(f"Normal images: {normal}")

def main():
    manager = GalleryManager("./img/gallery", "gallery.qmd")
    
    # Scan and analyze all images
    print("Scanning images and analyzing dimensions...")
    manager.scan_images()
    
    # Show statistics
    manager.print_image_stats()
    
    # Show new images that need to be added
    new_images = manager.get_new_images()
    if new_images:
        print("\nNew images to add:")
        for img in new_images:
            metadata = manager.metadata.get(img, {})
            layout = metadata.get('layout_class', 'normal')
            print(f"- {img} [{layout}]")
        
        # Generate markdown for new entries
        new_entries = manager.generate_new_entries()
        print("\nGenerated markdown:")
        print(new_entries)
    else:
        print("\nAll images are already in the gallery!")

if __name__ == "__main__":
    main()

