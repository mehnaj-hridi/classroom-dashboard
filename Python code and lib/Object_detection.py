import cv2
import urllib.request
import numpy as np
import time

url = 'http://10.209.150.158:81/capture'
winName = 'ESP32 CAMERA'
cv2.namedWindow(winName, cv2.WINDOW_AUTOSIZE)

classFile = r'D:\Python code and lib\coco.names'
configPath = r'D:\Python code and lib\ssd_mobilenet_v3_large_coco_2020_01_14.pbtxt'
weightsPath = r'D:\Python code and lib\frozen_inference_graph.pb'

classNames = []
with open(classFile, 'rt') as f:
    classNames = f.read().rstrip('\n').split('\n')

net = cv2.dnn_DetectionModel(weightsPath, configPath)
net.setInputSize(320, 320)
net.setInputScale(1.0 / 127.5)
net.setInputMean((127.5, 127.5, 127.5))
net.setInputSwapRB(True)

# Reference height from the first detection in this run
initial_height = None
drop_threshold_ratio = 0.25  # 25% drop means head down

print("Waiting for first person detection to set reference height...")

while True:
    try:
        imgResponse = urllib.request.urlopen(url)
        imgNp = np.array(bytearray(imgResponse.read()), dtype=np.uint8)
        img = cv2.imdecode(imgNp, -1)
    except Exception as e:
        print("Error grabbing frame:", e)
        continue

    img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

    classIds, confs, bbox = net.detect(img, confThreshold=0.5)

    person_boxes = [box for classId, box in zip(classIds.flatten(), bbox) if classId == 1] if len(classIds) else []

    head_down_detected = False

    if person_boxes:
        closest_box = max(person_boxes, key=lambda b: b[3])
        _, _, _, height = closest_box

        # Set the reference height ONLY on the first valid detection
        if initial_height is None:
            initial_height = height
            print(f"Reference height set: {initial_height}")
            time.sleep(0.5)  # small pause for stability

        else:
            if initial_height - height > initial_height * drop_threshold_ratio:
                head_down_detected = True

        cv2.rectangle(img, closest_box, color=(255, 0, 0), thickness=3)
        cv2.putText(img, "Closest Person", (closest_box[0] + 10, closest_box[1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 0, 0), 2)

    if head_down_detected:
        cv2.putText(img, "Head down detected", (30, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)
        print("Head down detected")

    cv2.imshow(winName, img)

    if cv2.waitKey(5) & 0xFF == 27:
        break

cv2.destroyAllWindows()
