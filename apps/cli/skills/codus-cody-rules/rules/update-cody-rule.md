---
name: update-cody-rule
description: Cody Rule Update Guidelines - Use when the user wants to update an existing Cody Rule to modify its behavior, scope, or severity for Codus to follow when generating code.
---

# Cody Rule Update Guidelines

## Overview

When updating an existing Cody Rule, it's important to ensure that the changes are clear, justified, and aligned with the overall goals of code generation. Updating a Cody Rule can help refine its effectiveness and ensure that it continues to meet the user's expectations and project requirements.

## Workflow for Updating a Cody Rule

1. **Identify the Cody Rule to Update**:
    - If the user specified a specific `uuid` of the Cody Rule they want to update, use it to identify the rule.
    - If the user described the rule to update without providing a `uuid`, list all rules (or filter by repository if specified), select the most relevant one based on the description, and confirm with the user that this is the correct rule to update before proceeding.
    - Otherwise, ask the user to specify the rule they want to update by providing its `uuid` or a clear description that can be used to identify it. Emphasize that `uuid` is the most reliable way to identify the rule for updating.

2. **Collect the user's intent for the update**: Understand the specific changes the user wants to make to the existing Cody Rule. Ask clarifying questions if necessary to ensure you have a clear understanding of the user's intent.

3. **Review the existing Cody Rule**: Retrieve the current definition of the Cody Rule that is being updated. This will help you understand the existing behavior and identify what changes need to be made.

4. **Draft the updated Cody Rule**: Based on the user's intent and the existing rule, draft an updated version of the Cody Rule that includes the desired changes. Use the guidelines outlined in the "Guidelines for Updating a Cody Rule" section to ensure the updated rule is well-structured and effective.

5. **Review the updated Cody Rule with the user**: Present the drafted updated Cody Rule to the user for feedback. Discuss any potential edge cases, exceptions, or clarifications needed to ensure the updated rule is comprehensive and actionable.

6. **Refine the updated Cody Rule**: Based on the user's feedback, refine the updated Cody Rule to address any concerns or suggestions. Ensure that the final version of the updated rule is clear, specific, and aligned with the user's goals.

7. **Save and Implement the updated Cody Rule**: Once the updated Cody Rule is finalized and approved by the user, save it. Send only the fields that were updated, along with the `uuid` to identify which rule to update.

Use the following command to save the updated Cody Rule:

```
codus rules update --uuid <uuid> [--repo-id <repository-id>] [--title <title>] [--rule <rule-content>] [--severity <severity-level>] [--scope <scope-level>] [--path <glob-pattern>]
```

8. **Communicate the updated Cody Rule**: Inform the user about the updated Cody Rule and how the changes will affect future code generation.

## Centralized Config Behavior

When centralized config is enabled, updating a rule may return centralized PR metadata instead of an immediate rule update.

In this case, report PR details and clarify the update is pending until PR merge and sync.

## Guidelines for Updating a Cody Rule

1. **Identify the Changes**: Clearly define what changes are being made to the existing Cody Rule. Are you modifying the rule's behavior, scope, severity, or other attributes?

2. **Justify the Changes**: Ensure that there is a clear justification for the changes being made to the Cody Rule. The updates should contribute to producing code that is more maintainable, efficient, or better aligned with the user's needs.

3. **Consider Edge Cases**: Think about any edge cases or exceptions that might arise from the updated rule. Address these in the updated rule definition to ensure Cody can handle them appropriately.

4. **Align with Project Goals**: Ensure that the updated Cody Rule continues to align with the overall goals and requirements of the project. The updated rule should contribute to producing code that meets the user's expectations and project requirements.

5. **Review and Refine**: After drafting the updated Cody Rule, review it for clarity and completeness. Present it to the user for feedback and refine it as necessary to ensure it effectively guides Cody's code generation process.
