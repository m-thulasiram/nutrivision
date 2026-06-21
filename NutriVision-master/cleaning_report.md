# Database Cleaning Report

This report documents all data cleaning and standardization actions executed on the NutriVision food database.

## 1. Summary of Actions

* Total records processed: 106
* Total records in cleaned database: 106
* Total updates executed: 16

---

## 2. Table of Executed Changes

| Food Entry | Action Taken | Change Detail |
| :--- | :--- | :--- |
| **aloo Tikki** | Fix VegNovVeg label | Changed ' ' (blank) to '0' (Vegetarian) |
| **Mixed Veg** | Correct Iron value | Changed extremely high Iron from 57.0mg to 2.0mg |
| **Mutton** | Correct Carbohydrates value | Changed Carbohydrates from 57.0g to 0.0g (consistent with animal protein) |
| **Cornflakes** | Recalculate Stated Calories | Changed stated Calories from 40 to 65 to align with macronutrients (Protein: 3.2g, Carbs: 11.0g, Fats: 0.9g) |
| **aloo Tikki** | Standardize Name Capitalization/Format | Renamed 'aloo Tikki' to 'Aloo Tikki' |
| **Bread made in wheat** | Standardize Name Capitalization/Format | Renamed 'Bread made in wheat' to 'Bread Made In Wheat' |
| **cheese** | Standardize Name Capitalization/Format | Renamed 'cheese' to 'Cheese' |
| **Aloo Matar ** | Standardize Name Capitalization/Format | Renamed 'Aloo Matar ' to 'Aloo Matar' |
| **Fruit and Nut chocolate** | Standardize Name Capitalization/Format | Renamed 'Fruit and Nut chocolate' to 'Fruit And Nut Chocolate' |
| **Egg Yolk ** | Standardize Name Capitalization/Format | Renamed 'Egg Yolk ' to 'Egg Yolk' |
| **Sweet Potatoes ** | Standardize Name Capitalization/Format | Renamed 'Sweet Potatoes ' to 'Sweet Potatoes' |
| **Orange juice** | Standardize Name Capitalization/Format | Renamed 'Orange juice' to 'Orange Juice' |
| **Pumpkin seeds** | Standardize Name Capitalization/Format | Renamed 'Pumpkin seeds' to 'Pumpkin Seeds' |
| **Chicken sausage** | Standardize Name Capitalization/Format | Renamed 'Chicken sausage' to 'Chicken Sausage' |
| **Vanilla Ice cream** | Standardize Name Capitalization/Format | Renamed 'Vanilla Ice cream' to 'Vanilla Ice Cream' |
| **Chocolate milk** | Standardize Name Capitalization/Format | Renamed 'Chocolate milk' to 'Chocolate Milk' |

---

## 3. Standardization Rules Applied

1. **Naming Conventions**:
   - Stripped all leading and trailing whitespace characters.
   - Normalized all food item names to standard Title Case (e.g. `Plain Omelette`, `Banana Chips`).
   - Retained special casing for branded names (e.g. `Glucone'D`).
2. **Missing Labels**:
   - Resolved empty/whitespace `VegNovVeg` labels (such as `aloo Tikki` which was corrected to `0` / Vegetarian).
3. **Macro-Calorie Alignment**:
   - Replaced impossible carbohydrate values for `Mutton` (changed `57.0`g carbs to `0.0`g carbs) to match the stated calories of `109 kcal`.
   - Adjusted `Cornflakes` stated calories to `65` (from `40`) to match macro calculations.
   - Corrected the extreme `Iron` value for `Mixed Veg` from `57.0` mg to a standard `2.0` mg.
