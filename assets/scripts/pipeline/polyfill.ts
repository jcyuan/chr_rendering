import { gfx, rendering } from "cc";

const { Format, SampleCount, TextureFlagBit, TextureType, SamplerInfo, Filter, Address } = gfx;

let __pplPolyfilled = false;

enum ResourceFlags {
    NONE = 0,
    UNIFORM = 0x1,
    INDIRECT = 0x2,
    STORAGE = 0x4,
    SAMPLED = 0x8,
    COLOR_ATTACHMENT = 0x10,
    DEPTH_STENCIL_ATTACHMENT = 0x20,
    INPUT_ATTACHMENT = 0x40,
    SHADING_RATE = 0x80,
    TRANSFER_SRC = 0x100,
    TRANSFER_DST = 0x200,
}

enum ResourceDimension {
    BUFFER,
    TEXTURE1D,
    TEXTURE2D,
    TEXTURE3D,
}

class ResourceDesc {
    reset (): void {
        this.dimension = ResourceDimension.BUFFER;
        this.alignment = 0;
        this.width = 0;
        this.height = 0;
        this.depthOrArraySize = 0;
        this.mipLevels = 0;
        this.format = Format.UNKNOWN;
        this.sampleCount = SampleCount.X1;
        this.textureFlags = TextureFlagBit.NONE;
        this.flags = ResourceFlags.NONE;
        this.viewType = TextureType.TEX2D;
    }
    dimension: ResourceDimension = ResourceDimension.BUFFER;
    alignment = 0;
    width = 0;
    height = 0;
    depthOrArraySize = 0;
    mipLevels = 0;
    format: gfx.Format = Format.UNKNOWN;
    sampleCount: gfx.SampleCount = SampleCount.X1;
    textureFlags: gfx.TextureFlagBit = TextureFlagBit.NONE;
    flags: ResourceFlags = ResourceFlags.NONE;
    viewType: gfx.TextureType = TextureType.TEX2D;
}

enum ResourceResidency {
    MANAGED,
    MEMORYLESS,
    PERSISTENT,
    EXTERNAL,
    BACKBUFFER,
}

const enum ResourceGraphValue {
    Managed,
    ManagedBuffer,
    ManagedTexture,
    PersistentBuffer,
    PersistentTexture,
    Framebuffer,
    Swapchain,
    FormatView,
    SubresourceView,
}

class ResourceTraits {
    constructor (residency: ResourceResidency = ResourceResidency.MANAGED) {
        this.residency = residency;
    }
    reset (residency: ResourceResidency): void {
        this.residency = residency;
    }
    declare residency: ResourceResidency;
}

class ResourceStates {
    reset (): void {
        this.states = gfx.AccessFlagBit.NONE;
    }
    states: gfx.AccessFlagBit = gfx.AccessFlagBit.NONE;
}

class DeviceTextureStub {  
    constructor(private _name: string, private _texture: gfx.Texture) {
    }  
    get name() { return this._name; }  
    get texture() { return this._texture; }  
}

// till 3.8.8, pipeline does not support external texture, so have to use ths way to patch it
export function _polyfillPPL(ppl: rendering.BasicPipeline): void {
    if (__pplPolyfilled)
        return;

    __pplPolyfilled = true;

    // @ts-ignore
    ppl.__proto__.hasExternalTexture = (function(name: string): boolean {
        // @ts-ignore
        const executor = this._executor;
        if (!executor)
            return false;
        
        return executor._context.deviceTextures.has(name);
    }).bind(ppl);

    // @ts-ignore
    ppl.__proto__.addExternalTexture = (function(name: string, texture: gfx.Texture, flags: gfx.ResourceFlags): void {
        // @ts-ignore
        const executor = this._executor;
        if (!executor)
            return;
        
        const { resourceGraph, deviceTextures } = executor._context;

        if (deviceTextures.has(name))
            return;
        
        const desc = new ResourceDesc();  
        desc.dimension = ResourceDimension.TEXTURE2D;  
        desc.width = texture.width;  
        desc.height = texture.height;  
        desc.depthOrArraySize = 1;  
        desc.mipLevels = texture.levelCount || 1;  
        desc.format = texture.format;  
        desc.sampleCount = SampleCount.X1;  
        desc.flags = flags;
        desc.viewType = TextureType.TEX2D;  
        
        resourceGraph.addVertex(  
            ResourceGraphValue.PersistentTexture,
            { texture },
            name,
            desc,
            new ResourceTraits(ResourceResidency.EXTERNAL),  
            new ResourceStates(),  
            new SamplerInfo(Filter.LINEAR, Filter.LINEAR, Filter.NONE, Address.CLAMP, Address.CLAMP, Address.CLAMP)  
        );
        
        deviceTextures.set(name, new DeviceTextureStub(name, texture));
    }).bind(ppl);
}

declare module "cc" {
    namespace rendering {
        interface BasicPipeline {
            hasExternalTexture(name: string): boolean;
            addExternalTexture(name: string, texture: gfx.Texture, flags: ResourceFlags): void;
        }
    }
}
