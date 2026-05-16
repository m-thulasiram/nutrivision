import kagglehub

print("Starting download... This might take a minute as it's downloading hundreds of images (~780 MB).")

# Download YOLO-formatted Food Image Dataset
path = kagglehub.dataset_download("josephvettom/food-image-dataset")

print("✅ Download Complete!")
print("Path to YOLO image dataset:", path)