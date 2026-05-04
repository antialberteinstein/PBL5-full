import numpy as np

def calculate_iou(box1, box2):
    """
    Calculate Intersection over Union (IoU) of two bounding boxes.
    
    Args:
        box1: [x1, y1, x2, y2]
        box2: [x1, y1, x2, y2]
        
    Returns:
        float: IoU value (0 to 1)
    """
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    union = area1 + area2 - intersection
    
    if union == 0:
        return 0
        
    return intersection / union

def deepface_to_standard_bbox(df_bbox):
    """
    Convert DeepFace bbox format {'x', 'y', 'w', 'h'} to [x1, y1, x2, y2].
    """
    x, y, w, h = df_bbox['x'], df_bbox['y'], df_bbox['w'], df_bbox['h']
    return [x, y, x + w, y + h]
