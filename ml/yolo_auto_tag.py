import cv2
import json
import math
import argparse
from ultralytics import YOLO

def distance(pt1, pt2):
    return math.sqrt((pt1[0] - pt2[0])**2 + (pt1[1] - pt2[1])**2)

def main(video_path, output_path):
    print(f"Loading YOLO model... (This might download the model on first run)")
    model = YOLO("yolov8n.pt")  # Nano model for speed, adjust to yolov8s.pt or yolov8m.pt for accuracy

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        fps = 30.0

    current_possessor = None
    last_event_time = -10
    
    events = []
    
    frame_count = 0
    skip_frames = max(1, int(fps / 5)) 
    
    print(f"Processing video {video_path} at ~{fps/skip_frames:.1f} FPS (skipping {skip_frames-1} frames)...")

    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        if frame_count % skip_frames != 0:
            continue
            
        # ByteTrackを使用するとBoT-SORTよりCPU上で高速に動作します
        results = model.track(frame, classes=[0, 32], persist=True, tracker="bytetrack.yaml", verbose=False)
        
        if not results or not results[0].boxes or results[0].boxes.id is None:
            continue
            
        boxes = results[0].boxes
        
        persons = []
        balls = []
        
        for i in range(len(boxes)):
            cls = int(boxes.cls[i].item())
            box = boxes.xyxy[i].cpu().numpy()
            track_id = int(boxes.id[i].item()) if boxes.id is not None else -1
            
            cx = (box[0] + box[2]) / 2
            bottom_y = box[3]
            center_y = (box[1] + box[3]) / 2
            
            if cls == 0: # person
                persons.append({
                    'id': track_id,
                    'feet': (cx, bottom_y),
                    'box': box
                })
            elif cls == 32: # sports ball
                balls.append({
                    'id': track_id,
                    'center': (cx, center_y),
                    'box': box
                })
                
        if len(balls) == 0 or len(persons) == 0:
            continue
            
        ball = balls[0] 
        
        closest_person = None
        min_dist = float('inf')
        
        for p in persons:
            d = distance(ball['center'], p['feet'])
            if d < min_dist:
                min_dist = d
                closest_person = p
                
        POSSESSION_THRESHOLD = 150 
        
        current_time_sec = frame_count / fps
        
        if min_dist < POSSESSION_THRESHOLD:
            new_possessor = closest_person['id']
            
            if current_possessor is not None and new_possessor != current_possessor:
                if current_time_sec - last_event_time > 2.0:
                    print(f"[{int(current_time_sec)}s] Possession changed from ID:{current_possessor} to ID:{new_possessor}")
                    
                    events.append({
                        "minute": int(current_time_sec),
                        "event_type": "pass"
                    })
                    last_event_time = current_time_sec
                    
            current_possessor = new_possessor
            
        # 5秒(動画内時間)ごとに進捗を表示
        if frame_count % int(fps * 5) == 0:
            print(f"... 動画の {int(current_time_sec)} 秒まで解析完了 (見つかったイベント数: {len(events)})", flush=True)

    cap.release()
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(events, f, ensure_ascii=False, indent=2)
        
    print(f"\nDone! Extracted {len(events)} events.")
    print(f"Saved to {output_path}. You can copy the contents of this file and paste it into the 'AIデータを取り込む' menu in the web app.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Auto-tag futsal events using YOLOv8")
    parser.add_argument("video_path", help="Path to the input video file")
    parser.add_argument("--output", default="events.json", help="Path to output JSON file")
    
    args = parser.parse_args()
    main(args.video_path, args.output)
