import { Box, Text, useInput } from "ink";
import { Select } from "@inkjs/ui";
import { useMemo, useState, type ReactNode } from "react";

export interface FilterableOption {
  label: string;
  value: string;
  /** Text matched by the filter (defaults to label). */
  searchText?: string;
}

export function FilterableSelect({
  options,
  visibleOptionCount = 12,
  onChange,
  onCancel,
  emptyLabel = "No matches",
  leadingOptions = [],
}: {
  options: FilterableOption[];
  visibleOptionCount?: number;
  onChange: (value: string) => void;
  onCancel: () => void;
  emptyLabel?: string;
  /** Always shown above filtered results (e.g. Back). */
  leadingOptions?: FilterableOption[];
}): ReactNode {
  const [query, setQuery] = useState("");

  useInput((input, key) => {
    if (key.escape) {
      if (query.length > 0) {
        setQuery("");
        return;
      }
      onCancel();
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((current) => current.slice(0, -1));
      return;
    }

    // Ctrl+U clears the filter
    if (key.ctrl && input === "u") {
      setQuery("");
      return;
    }

    if (key.upArrow || key.downArrow || key.return || key.tab) return;
    if (key.ctrl || key.meta) return;

    if (input && input.length === 1 && input >= " ") {
      setQuery((current) => current + input);
    }
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = (option.searchText ?? option.label).toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, query]);

  const selectOptions = useMemo(
    () => [...leadingOptions, ...filtered],
    [leadingOptions, filtered],
  );

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>
          <Text dimColor>Filter </Text>
          {query.length > 0 ? (
            <Text color="cyan">{query}</Text>
          ) : (
            <Text dimColor>(type to search)</Text>
          )}
          {query.length > 0 ? (
            <Text dimColor>
              {" "}
              · {filtered.length}/{options.length}
              {" · Esc clear"}
            </Text>
          ) : (
            <Text dimColor> · Esc back</Text>
          )}
        </Text>
      </Box>
      {selectOptions.length === 0 ? (
        <Text dimColor>{emptyLabel}</Text>
      ) : (
        <Select
          key={query}
          visibleOptionCount={visibleOptionCount}
          highlightText={query.trim() || undefined}
          options={selectOptions.map(({ label, value }) => ({ label, value }))}
          onChange={onChange}
        />
      )}
    </Box>
  );
}
