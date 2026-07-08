from PIL import Image

def remove_color():
    try:
        img = Image.open('C:\\Users\\Saixu\\.gemini\\antigravity\\brain\\6bdf2b8d-159e-42c8-b34b-bcafaa98b266\\ui_panel_modular_1783468347451.jpg').convert("RGBA")
        datas = img.getdata()

        bg_color = datas[0] # Grab top-left pixel color automatically!

        newData = []
        for item in datas:
            # Check if color is close to the background color
            if abs(item[0]-bg_color[0])<20 and abs(item[1]-bg_color[1])<20 and abs(item[2]-bg_color[2])<20:
                newData.append((255, 255, 255, 0)) # Transparent
            else:
                newData.append(item)

        img.putdata(newData)
        img.save("ui_panel.png", "PNG")
        print("Success")
    except Exception as e:
        print(f"Error: {e}")

remove_color()
