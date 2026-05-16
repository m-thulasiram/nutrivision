import kagglehub
import os
import yaml
from ultralytics import YOLO

def find_image_folders(base_path):
    """Searches the downloaded dataset to find exactly where the training images are hidden."""
    train_path, val_path = None, None
    for root, dirs, files in os.walk(base_path):
        # Look for folders containing 'train' and 'images'
        if 'train' in root.lower() and 'images' in root.lower() and not train_path:
            train_path = root
        # Look for folders containing 'valid' or 'val' and 'images'
        if ('valid' in root.lower() or 'val' in root.lower()) and 'images' in root.lower() and not val_path:
            val_path = root
            
    # Fallback just in case they are just named 'train' and 'valid'
    if not train_path:
        train_path = os.path.join(base_path, 'train')
    if not val_path:
        val_path = os.path.join(base_path, 'valid')
        
    return train_path.replace('\\', '/'), val_path.replace('\\', '/')

def create_yaml_file(base_path):
    """Generates the missing configuration file."""
    # These are the 20 Indian food classes listed on the dataset's Kaggle page
    food_classes = [
        "Chicken_Curry", "Plain_Omelette", "Spinach_Paneer", "Appam", "Avial", 
        "Banana_Chips", "Chapati_Roti", "Chocolate_Cake", "Fruit_Salad", "Idli", 
        "Kulfi", "Marble_Cake", "Masala_Dosa", "Masala_Vada", "Mutton_Biryani", 
        "Pancake", "Sambar", "Uttapam", "Lemonade", "Rice_Puttu"
    ]
    
    train_dir, val_dir = find_image_folders(base_path)
    
    # Create the file right in your current project folder
    yaml_path = os.path.join(os.getcwd(), 'custom_dataset.yaml')
    yaml_content = {
        'train': train_dir, 
        'val': val_dir, 
        'nc': 20,
        'names': food_classes
    }
    
    with open(yaml_path, 'w') as f:
        yaml.dump(yaml_content, f, sort_keys=False)
        
    return yaml_path

def main():
    print("🔍 Locating your downloaded dataset...")
    base_path = kagglehub.dataset_download("josephvettom/food-image-dataset")
    print(f"✅ Dataset found at: {base_path}")
    
    print("📝 The dataset author forgot the .yaml file! Generating one automatically...")
    yaml_path = create_yaml_file(base_path)
    print(f"✅ Created configuration file at: {yaml_path}")
    
    print("\n🧠 Initializing YOLOv8 Nano model...")
    model = YOLO('yolov8n.pt')

    print("🚀 Starting the AI training process! This will take some time...")
    
    # Train the model
    model.train(
        data=yaml_path,
        epochs=10,        # Number of learning cycles
        imgsz=640,        # Image resolution
        device='cpu'      # Use the CPU
    )
    
    print("🎉 Training complete! Your new 'brain' is saved inside 'runs/detect/train/weights' as 'best.pt'.")

if __name__ == '__main__':
    main()