# NutriVision Food Database Validation Report

This report presents a thorough audit of the generated `expanded_food_database.csv` dataset.

## 1. Executive Summary

| Metrics | Value | Status |
| :--- | :---: | :---: |
| **Total Foods** | 504 | PASS (Target: 500+ foods) |
| **Unique States** | 28 | PASS (Target: 28 states) |
| **Min Foods per State** | 18 | PASS (Target: Min 15 per state) |
| **Missing Values** | 0 | PASS |
| **Invalid VegNovVeg Labels** | 0 | PASS |
| **Invalid Meal Types** | 0 | PASS |
| **Invalid State Names** | 0 | PASS |

---

## 2. Quality Scores

| Area | Score | Notes |
| :--- | :---: | :--- |
| **Database Quality** | **90/100** | Checks duplicate names, missing fields, and schema validity. |
| **Nutrition Accuracy** | **100/100** | Checks boundary ranges and calorie-macro coherence. |
| **Regional Coverage** | **100/100** | Evaluates presence of all 28 states and food counts. |
| **Recommendation Readiness** | **86/100** | Analyzes duplicates across states and regional mappings. |

---

## 3. Detailed Audit Findings

### A. Duplicate Food Names
* **Count**: 2
* **Details**: List of duplicate names is stored in `duplicate_foods.csv`.

| Food Name | State |
| --- | --- |
| Jaljeera Beverage Cold | Madhya Pradesh |
| Jaljeera Beverage Cold | Rajasthan |

### B. Duplicate Nutrition Profiles
* **Count**: 111
* **Details**: Rows sharing identical nutrition profiles:

Found 111 rows with identical nutritional values (common in standardized recipes). Examples include standard beverages (like Black Tea, Herbal Infusions) and basic snacks across different states.

### C. Missing Values
* **Count**: 0

*No records found.*

### D. Invalid VegNovVeg Labels
* **Count**: 0

*No records found.*

### E. Invalid Meal Types
* **Count**: 0

*No records found.*

### F. Invalid State Names
* **Count**: 0

*No records found.*

---

## 4. Nutrition Outliers & Sanity Checks

### A. Value Outliers
* **Count**: 0
* **Rules checked**:
  - Calories < 0 or > 1500 kcal
  - Protein > 100g
  - Fat > 100g
  - Iron > 20mg
  - Calcium > 2000mg

*No records found.*

### B. Macro-to-Calorie Discrepancies
* **Count**: 0
* **Rule**: Expected Calories = (Protein * 4) + (Carbs * 4) + (Fat * 9). Checked if absolute difference is > 80 kcal.

*No records found.*

---

## 5. Regional Consistency

### A. Foods Assigned to Wrong States
* **Count**: 0

*No records found.*

### B. Foods Appearing in Multiple States
* **Count**: 2

Found 2 entries with names shared across states. Examples: Jaljeera Beverage Cold.

---

*This report was automatically compiled by the NutriVision Database Audit Subagent.*
