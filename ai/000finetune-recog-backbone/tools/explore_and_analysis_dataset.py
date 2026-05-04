import os
import argparse
from pathlib import Path
from collections import Counter
import matplotlib.pyplot as plt
import numpy as np

def analyze_dataset(dataset_path):
    dataset_path = Path(dataset_path)
    if not dataset_path.exists():
        print(f"Error: Dataset path {dataset_path} does not exist.")
        return

    print(f"Analyzing dataset at: {dataset_path.absolute()}")
    
    classes = [d for d in dataset_path.iterdir() if d.is_dir()]
    num_classes = len(classes)
    
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    
    stats = {}
    total_images = 0
    
    for cls_dir in classes:
        images = [f for f in cls_dir.iterdir() if f.suffix.lower() in image_extensions]
        stats[cls_dir.name] = len(images)
        total_images += len(images)
        
    if not stats:
        print("No images found in the dataset.")
        return

    counts = list(stats.values())
    min_imgs = min(counts)
    max_imgs = max(counts)
    mean_imgs = np.mean(counts)
    median_imgs = np.median(counts)
    
    print("\n--- Summary Statistics ---")
    print(f"Total Classes: {num_classes}")
    print(f"Total Images:  {total_images}")
    print(f"Min Images/Class: {min_imgs}")
    print(f"Max Images/Class: {max_imgs}")
    print(f"Mean Images/Class: {mean_imgs:.2f}")
    print(f"Median Images/Class: {median_imgs}")
    
    print("\n--- Detailed Class Breakdown ---")
    # Sort by count descending
    sorted_stats = sorted(stats.items(), key=lambda x: x[1], reverse=True)
    for name, count in sorted_stats:
        print(f"  {name:20}: {count} images")

    # Optional: Plotting
    try:
        plt.figure(figsize=(12, 6))
        class_names = [s[0] for s in sorted_stats]
        class_counts = [s[1] for s in sorted_stats]
        
        plt.bar(class_names, class_counts, color='skyblue')
        plt.xlabel('Class Name')
        plt.ylabel('Number of Images')
        plt.title('Dataset Distribution')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        
        output_plot = dataset_path.parent / "dataset_distribution.png"
        plt.savefig(output_plot)
        print(f"\nDistribution plot saved to: {output_plot.absolute()}")
    except Exception as e:
        print(f"\nCould not generate plot: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze a face recognition dataset.")
    parser.add_argument("--path", type=str, default="dataset", help="Path to the dataset directory")
    args = parser.parse_args()
    
    # If path is relative, make it relative to the script location if needed
    # but here we'll just use what's provided.
    analyze_dataset(args.path)
