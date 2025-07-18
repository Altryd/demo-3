import easyocr

reader = easyocr.Reader(['en'])
result = reader.readtext('image.png', paragraph=True)
print(result)
