#!/bin/bash
cd tests-selfmade-project-3-public/

if [ -s result.txt ]; then
  # The file is not-empty.
  echo -e "\e[31mИсправьте ошибки:\e[0m"
  cat result.txt
  exit 1
else
  # The file is empty.
  echo -e "\e[32mТесты успешно пройдены\e[0m"
  exit 0
fi