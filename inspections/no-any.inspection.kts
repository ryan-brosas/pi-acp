import com.intellij.psi.*

// Flags declared 'any' types (annotations, parameters, generics) but allows
// `as any` casts on untyped external data, per AGENTS.md.
val declaredAnyInspection = localInspection { psiFile, inspection ->
    psiFile.descendants()
        .filter { it.text == "any" && it.javaClass.simpleName != "LeafPsiElement" }
        .filter { node ->
            node.parents(withSelf = false).none { p -> p.javaClass.simpleName == "TypeScriptAsExpressionImpl" }
        }
        .forEach { inspection.registerProblem(it, "Avoid declaring 'any' — use an explicit type or unknown") }
}

listOf(
    InspectionKts(
        id = "no-declared-any-ts",
        localTool = declaredAnyInspection,
        name = "No declared any in TypeScript",
        htmlDescription = "Avoid declared 'any' types; 'as any' casts for untyped external data are allowed.",
        level = HighlightDisplayLevel.WARNING
    )
)
