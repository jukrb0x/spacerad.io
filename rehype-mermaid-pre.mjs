import { visit } from "unist-util-visit";

/**
 * Rehype plugin that converts mermaid code blocks into <div class="mermaid">
 * elements before rehype-pretty-code can process them.
 *
 * Must be placed before rehype-pretty-code in the plugin pipeline.
 */
export function rehypeMermaidPre() {
	return (tree) => {
		visit(tree, "element", (node) => {
			if (
				node.tagName === "pre" &&
				node.children?.length === 1 &&
				node.children[0].tagName === "code"
			) {
				const code = node.children[0];
				const className = code.properties?.className || [];

				if (className.includes("language-mermaid")) {
					// Extract text content from the code block
					const text = extractText(code);

					// Replace the <pre> with a <div class="mermaid">
					node.tagName = "div";
					node.properties = { className: ["mermaid"] };
					node.children = [{ type: "text", value: text }];
				}
			}
		});
	};
}

function extractText(node) {
	if (node.type === "text") return node.value;
	if (node.children) return node.children.map(extractText).join("");
	return "";
}
