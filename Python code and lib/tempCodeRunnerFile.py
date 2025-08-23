import cv2
import urllib.request
import numpy as np

# OBJECT CLASSIFICATION PROGRAM FOR VIDEO IN IP ADDRESS

url = 'http://192.168.0.110:81/capture'
winName = 'ESP32 CAMERA'
cv2.namedWindow(winName, cv2.WINDOW_AUTOSIZE)

# Provide full paths for the model files and class names file
classFile = r'D:\Python code and lib\coco.names'
configPath = r'D:\Python code and lib\ssd_mobilenet_v3_large_coco_2020_01_14.pbtxt'
weightsPath = r'D:\Python code and lib\frozen_inference_graph.pb'

# Load class names
classNames = []
with open(classFile, 'rt') as f:
    classNames = f.read().rstrip('\n').split('\n')

# Load the pre-trained model
net = cv2.dnn_DetectionModel(weightsPath, configPath)
net.setInputSize(320, 320)
net.setInputScale(1.0 / 127.5)
net.setInputMean((127.5, 127.5, 127.5))
net.setInputSwapRB(True)

while True:
    imgResponse = urllib.request.urlopen(url)
    imgNp = np.array(bytearray(imgResponse.read()), dtype=np.uint8)
    img = cv2.imdecode(imgNp, -1)

    img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)

    classIds, confs, bbox = net.detect(img, confThreshold=0.5)

    # Check if person is detected (person class id in COCO is 1)
    person_detected = False
    if len(classIds) != 0:
        for classId in classIds.flatten():
            if classId == 1:  # COCO person class id is 1
                person_detected = True
                break

    if person_detected:
        # Draw detections as usual
        for classId, confidence, box in zip(classIds.flatten(), confs.flatten(), bbox):
            cv2.rectangle(img, box, color=(0, 255, 0), thickness=3)
            label = classNames[classId - 1] if classId - 1 < len(classNames) else str(classId)
            cv2.putText(img, label, (box[0] + 10, box[1] + 30),
                        cv2.FONT_HERSHEY_COMPLEX, 1, (0, 255, 0), 2)
    else:
        # No person detected
        print("Head down detected")
        # Optionally, put text on the image too
        cv2.putText(img, "Head down detected", (30, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 3)

    cv2.imshow(winName, img)

    if cv2.waitKey(5) & 0xFF == 27:
        break

cv2.destroyAllWindows()
