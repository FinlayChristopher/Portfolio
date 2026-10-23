<!--
  The renderer page. How this file becomes the page:
  - the first paragraph after the # title shows as the grey line under it
  - a picture whose file is a video becomes a window: the [text] is the window's
    title, and "text in quotes" after the file name is the caption under it
  - a quote block (lines starting with >) becomes the facts box; start each line
    with **Label:**
  - each ### heading starts a new problem block
  Files are found relative to this one, so videos next to it need just their name.
-->

# DirectX 11 renderer

A renderer I'm building in C++ to learn the graphics pipeline from the bottom up, one feature at a time.

![Real-Time Render - DirectX 11](Cubes.mp4 "Textured cubes lit per pixel. The panel is ImGui, reading live values from the renderer.")

> **Built with:** C++, HLSL, DirectX 11, ImGui
> **Status:** In progress, scoped to 30 November 2026
> **Next:** An OBJ model loader, then shadow mapping, then procedural generation

## Problems I solved

### Lighting every pixel, not every corner

**Problem:** lighting worked out at the corners of a cube and blended across the face can't show a highlight in the middle of it, because the direction to the camera changes across the face.

**What I did:** moved the lighting into the pixel shader. Each pixel adds ambient, diffuse and specular light, each one an amount times the surface colour times the light colour.

```hlsl
float4 PS_main(VS_Out input) : SV_TARGET
{
    float3 normalW = normalize(input.normal);
    float4 texColor = diffuseTex.Sample(anisotropicSampler, input.texCoord);

    float diffuseAmount = max(dot(normalW, -light.Direction.xyz), 0.0f);
    float4 diffuse = diffuseAmount * (texColor * light.Diffuse);

    float3 reflected = reflect(light.Direction.xyz, normalW);
    float3 toCamera = normalize(cameraPosition - input.posW);
    float specularAmount = pow(max(dot(reflected, toCamera), 0.0f), material.Shininess.x);
    float4 specular = specularAmount * (material.Specular * light.Specular);

    float4 ambient = texColor * light.Ambient;
    return ambient + diffuse + specular;
}
```

**Bug on the way:** my first lit cube drew completely black. The code was right; the light was travelling towards the camera, so the only lit faces were the ones facing away from me. Moving the camera to the other side proved it.

### Any number of objects, placed at random

**Problem:** every cube had its own hand-written matrix and its own block of draw code, so adding one meant copying code.

**What I did:** a `SceneObject` struct holding a name, a position, a world matrix and a spin, kept in a `std::vector`. Objects are created once at start-up with `<random>`, updated in one loop and drawn in another, so the count is one number.

```cpp
for (size_t i = 0; i < objectCount; i++)
{
    SceneObject object;
    object.name = "Object" + std::to_string(i + 1);
    object.position = XMFLOAT3(distributionX(randomNumber), distributionY(randomNumber), distributionZ(randomNumber));
    object.spinSpeed = distributionSpeed(randomNumber);
    object.spinOffset = distributionOffset(randomNumber);
    XMStoreFloat4x4(&object.world, XMMatrixTranslation(object.position.x, object.position.y, object.position.z));
    _Objects.push_back(object);
}
```

**Bug on the way:** my first version looped while `i < _Objects.size()` and pushed into the same vector inside the loop. Every pass moved the finish line, so the loop never ended and the window stayed white.

### Resizing the window

**Problem:** maximising the window stretched the old picture, and the ImGui panel stopped responding to clicks: ImGui read the real window size while the picture was drawn at the old one.

**What I did:** on every `WM_SIZE`, release the old views, resize the swap chain's buffers, make new views and a matching depth buffer, then update the viewport and the projection's aspect ratio. A timer keeps frames coming while the window edge is held.

```cpp
void DX11Framework::Resize(UINT width, UINT height)
{
    _immediateContext->OMSetRenderTargets(0, nullptr, nullptr);
    _frameBufferView.Reset();
    _depthStencilView.Reset();
    _immediateContext->Flush();

    ThrowOnFail(_swapChain->ResizeBuffers(0, width, height, DXGI_FORMAT_UNKNOWN, 0));
    CreateFrameBuffer();

    _viewport.Width = (float)width;
    _viewport.Height = (float)height;
    _immediateContext->RSSetViewports(1, &_viewport);

    float aspect = _viewport.Width / _viewport.Height;
    XMStoreFloat4x4(&_Projection, XMMatrixPerspectiveFovLH(XMConvertToRadians(90), aspect, 0.01f, 100.0f));
}
```

**Bugs on the way:** my first aspect ratio divided two whole numbers, so 1920 / 1080 came out as 1 and the scene was squashed. Then, while dragging the window edge, memory rose from about 70 MB to about 180 MB and fell back when I stopped. Direct3D frees released buffers later rather than at once, and every step of a drag made a new full-size set. I added `Flush()` before the resize and I'm measuring how much it helps.

[Source on GitHub](https://github.com/FinlayChristopher/Real-Time-Rendering-Framework)
