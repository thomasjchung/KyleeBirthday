# Happy Birthday Kylee - 3D Interactive Museum Gallery

A beautiful, fully immersive 3D interactive museum gallery website to celebrate Kylee's birthday! Walk through a 3D museum with a character that starts outside and enters the building for an endless gallery experience.

## Features

- 🎨 **Museum Entrance Page** - Beautiful animated entrance with "Happy Birthday Kylee" message
- 👩 **Female Character** - A 3D character that starts outside the museum
- 🏛️ **True 3D Museum** - Walk through a fully 3D interactive gallery space using Three.js
- 🚶 **Forward Walk Experience** - Simple forward movement (↑ or W key) for an endless walk
- 🖼️ **Endless Gallery** - Paintings automatically generate as you walk forward
- 🎮 **Mouse Look** - Move your mouse to look around while walking
- 🖼️ **3D Paintings** - Images displayed as framed paintings on alternating walls
- ✨ **Beautiful Lighting** - Dynamic lighting with spotlights highlighting each painting

## Setup

1. **Add Images**: Place your images in the `images` folder with names:
   - `image1.jpg` (or `.jpeg` or `.png`)
   - `image2.jpg`
   - `image3.jpg`
   - ... up to `image16.jpg` (or more - they'll cycle)

   The gallery will automatically load images and cycle through them as you walk. Images alternate between left and right walls.

2. **Run Locally**: 
   
   **Important**: You need to run this from a local server (not just open the HTML file) due to CORS restrictions with Three.js modules.
   
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # Using Node.js (if you have http-server installed)
   npx http-server
   
   # Using PHP
   php -S localhost:8000
   ```
   
   Then visit `http://localhost:8000` in your browser.

## Controls

- **↑ Arrow Key** or **W Key**: Walk forward (endless walk through the gallery)
- **Mouse Movement**: Look around while walking
- **Click**: Activate mouse look controls
- **Exit Button**: Return to the entrance page

## How It Works

1. You start outside the museum with a female character
2. Click to activate controls, then press ↑ or W to start walking
3. The character walks forward into the museum entrance
4. Once inside, you continue walking forward endlessly
5. Paintings automatically appear on the walls as you progress
6. Move your mouse to look around and admire the paintings
7. The gallery is endless - new paintings generate as you walk

## Technical Details

- Built with **Three.js** for 3D rendering
- Custom mouse look controls for first-person navigation
- Endless gallery system that generates paintings as you walk
- Character animation with walking cycle
- Supports multiple image formats (jpg, jpeg, png)
- Responsive design that works on desktop

## Customization

- **Museum Size**: Edit `MUSEUM_WIDTH` and `MUSEUM_HEIGHT` in `gallery3d.js`
- **Painting Count**: Modify the `imageNumbers` array in `loadPaintings()` function
- **Walk Speed**: Change `WALK_SPEED` constant (currently 5)
- **Painting Spacing**: Adjust `PAINTING_SPACING` (currently 8 units)
- **Colors & Materials**: Adjust material colors in the `createMuseum()` function
- **Character Appearance**: Modify the character creation in `createCharacter()`

## Browser Compatibility

Works best in modern browsers (Chrome, Firefox, Safari, Edge) with WebGL support. Requires a browser that supports ES6 modules and Three.js.

## Notes

- Make sure to run from a local server (not file://) due to CORS requirements
- The gallery uses placeholder images if your image files aren't found
- All images are loaded asynchronously for better performance
- The gallery is truly endless - paintings continue to generate as you walk forward
