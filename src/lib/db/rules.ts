export interface RuleRow {
    country_code: string;
    rule_year: number;
    label: string;
    required_fields: string[];
    required_calculations: string[];
    checks: string[];
}
