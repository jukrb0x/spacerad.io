---
title: 'Memory Optimization Algorithm for Landscape Grass Based on Visibility Culling in UE5'
description: 'In-depth memory optimization of Landscape Grass, achieving approximately 50% reduction in grass memory usage on mobile devices.'
pubDate: 2023-05-20
lang: en
tags: ['Unreal Engine', 'Landscape', 'Foliage', 'Performance']
comment: true
socialImage: '../ue5-landscape-grass-en/a-look-under-the-hood-at-unreal-engine-landscape-grass-en.jpg'
---

![Landscape Grass in UE5](./landscaspe-grass-world.jpeg)

This article presents a method to reduce the memory footprint of Landscape Grass. By analyzing Landscape Grass as an excellent scene vegetation rendering solution, we can modify its planting pipeline to further optimize memory usage. This optimization has particularly significant effects on mobile devices, where it can save around 40% to 50% of Landscape Grass memory usage.

> For a detailed analysis of Landscape Grass principles, please refer to previous blog: [UE5 Landscape Grass Source Analysis: A Look Under the Hood](../ue5-landscape-grass-en/)

## Optimization Approach: Visibility Culling

After analyzing source code, we found that generation of Landscape Grass is related to position of camera in scene, but not to camera's orientation. Therefore, all grass within a certain radius around camera will be generated and stored in memory. On performance-constrained mobile devices, we can apply concept of GPU visibility culling to optimize Landscape Grass memory usage. The fundamental principle of this optimization is to eliminate what is not needed.

![Top-down View of Grass Rendering](./mem-opt-overview.png)

In above image, red area represents frustum region. Grass outside this region will be culled by GPU, but corresponding number of Grass Instances is still allocated in memory, leading to some waste.

Without affecting gameplay, we can consider following approach:

-   All grass in front of camera's field of view should be generated because player may move camera, and grass in distance continuously comes into view during forward movement.
-   Considering that grass is not updated every frame (as mentioned in theoretical part regarding TickInterval and maximum AsyncTasks), we should avoid sudden appearance or disappearance of grass in distance while player is moving forward.
-   We do not need to generate all grass behind camera's field of view. However, to avoid vegetation loss, we introduce a small Patch Zone (the yellow area in image) behind camera as a buffer to ensure that grass behind player is correctly loaded.
-   No grass should be planted in remaining areas.
-   This approach does not consider height in 3D space and is a 2D optimization solution.

## Filling the Gap

Grass Variety is generated based on Grass Subsections, and we need to consider some boundary cases.

A Grass Subsection is a quadrangle (not a Landscape Component Subsection), so it is natural to use center of subsection's projection in $z$ direction as our starting point for calculations.

We have Camera Forward vector $V_{cam}$, and let's assume that vector from starting point of $V_{cam}$ to center $P$ of subsection is $V_{sub}$.

Therefore, determination of land blocks in front of field of view is:

$$
V_{cam} \cdot V_{sub} > 0
$$

If Camera Vector $V_{cam}$ is in front of subsection, but some grass within FOV is exposed, that portion of grass will disappear.

![How grass disappears in field of view](./missing-grass.png)

Dealing with this situation is relatively simple. We only need to check if Camera is within Bounding Box (AABB)[^AABB] of this subsection. When Camera is within this subsection, forcefully load grass on this block. However, considering boundary cases where camera is at edge of subsection, grass on neighboring blocks also disappears. We can modify determination formula as follows:

$$
V_{cam} \cdot V_{sub} \geq 0
$$

[^AABB]: AABB stands for Axis-Aligned Bounding Box.

However, when $V_{cam} \cdot V_{sub} = 0$, an entire row of grass will also be loaded, which is obviously not optimal solution we want. At same time, grass on land blocks $V_{sub}$ where $V_{cam} \cdot V_{sub} \to 0-$ will also disappear:

![Boundary case of orthogonal land block with camera](./grass-orthogonal.png)

We can make additional judgments based on (shortest) distance from Camera to subsection, that is, ratio of distance from tail of $V_{cam}$ to AABB of subsection and size of subsection's side length. This can control loading of nearby grass on land blocks.

However, such a complex algorithm may not be very pleasant to work with.

### Generalized Algorithm

Instead of considering whether Camera is inside subsection, we can use following generalized algorithm:

Assuming Distance Vector from Camera to any vertex of subsection is $V_d$, when $V_d \cdot V_{cam} > 0$, we can identify all subsections located in Camera's orthogonal direction and in front of it. Then, we check if distance from Camera to AABB of subsection is less than side length of subsection in order to load nearby grass on land blocks.

![Final Generalized Algorithm](./final-algorithm.png)

### Controlling Culling Granularity

If you think this is end of optimization solution, then you are _too young too simple_. Through source code, we find that we have another variable called `GMaxInstancesPerComponent`, which is used to control maximum number of instances per **subsection** (not semantically landscape component...). The engine's default value is 65536 ($2^{16}$), with a lower limit of 1024 ($2^{10}$), and no upper limit.

> See previous article: [UE5 Landscape Grass Source Analysis: A Look Under the Hood](../ue5-landscape-grass-en/)

Therefore, smaller `GMaxInstancesPerComponent`, more subsections there will be, and grass density in scene will appear slightly sparser. This also means that granularity of culling is smaller, which benefits memory optimization.

By setting different values for `GMaxInstancesPerComponent` and comparing number of built tasks before and after enabling optimization algorithm, we can observe how it affects grass generation process:

In demo scene, based on improved generation algorithm:

| `GMaxInstancesPerComponent`     | Built Tasks Before Optimization | Built Tasks After Optimization | Optimization Ratio |
| ------------------------------- | ------------------------------- | ------------------------------ | ------------------ |
| $2^{10}=1024$                   | 151                             | 87                             | 42.4%              |
| $2^{11}=2048$                   | 111                             | 66                             | 40.5%              |
| $2^{16}=65536$ (Engine Default) | 12                              | 10                             | 16.7%              |

We can see that `GMaxInstancesPerComponent` has a significant impact on grass generation tasks and should not be set too large.

## Algorithm Implementation

_You can borrow my ideas, but do you really want to copy my code?_

Pseudocode for core algorithm:

```cpp showLineNumbers
// Iterate over subsection vertices
for (Vector Vertex: Subsections)
{
	IsCameraBehind = IsCameraBehind || (
		(Vertex.X - CameraLocation.X) * CameraForward.X +
		(Vertex.Y - CameraLocation.Y) * CameraForward.Y) > 0);
}

if (!IsCameraBehind && DistanceFromCameraToSubsection) > Threshold)
{
	// Don't spawn grass
}
else
{
	// Spawn grass
}
```

### Memory Testing

Based on theoretical analysis, our Landscape Grass memory usage can be reduced to approximately half of original.

The author conducted ablation experiments on a demo scene and analyzed number of specified vegetation StaticMesh instances to determine memory size. The following are experimental results:

| `GMaxInstancesPerComponent` | NumInstances Before Optimization | NumInstances After Optimization | Optimization Ratio |
| --------------------------- | -------------------------------- | ------------------------------- | ------------------ |
| $2^{10}=1024$               | 87595                            | 48642                           | 44.5%              |
| $2^{11}=2048$               | 99239                            | 58290                           | 41.3%              |

In another simple demo scene with less grass, a quick memory analysis was performed, and optimization ratio was approximately 46.4%:

| Item                 | Memory [MB] | Built Tasks |
| -------------------- | ----------- | ----------- |
| Map without grass    | 582         | N/A         |
| Default algorithm    | 610         | 12          |
| Culling optimization | 595         | 10          |

The results are quite significant.

## Reference

1. [UE5 Landscape Grass Source Analysis: A Look Under the Hood](../ue5-landscape-grass-en/)
2. [《InsideUE4》GamePlay 架构（十一）Subsystems](https://zhuanlan.zhihu.com/p/158717151)
3. [UE4 Mobile Landscape 总览及源码解析](https://zhuanlan.zhihu.com/p/144031549)
4. [UE4 中的植被工具](https://zhuanlan.zhihu.com/p/389430858)
5. [LearnOpenGL - Instancing](https://learnopengl.com/Advanced-OpenGL/Instancing)
6. [UE4 材质系统](https://papalqi.cn/ue4材质系统/)
7. [Halton Sequence](https://web.maths.unsw.edu.au/~josefdick/MCQMC_Proceedings/MCQMC_Proceedings_2012_Preprints/100_Keller_tutorial.pdf)
