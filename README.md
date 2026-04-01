# flatsearch

1. discover links of applicable postings
   ```sh
   node src/discover.ts --district 1020 --district 1030 --price 300000 --area 60 > discovered.txt
   ```
2. obtain postings
   ```sh
   node src/obtain.ts --output-directory obtained --empty-output-directory < discovered.txt
   ```
3. run inference
   ```sh
   make --keep-going
   ```

   inference providers sometimes aren't great at outputting valid json or even generally being available → `--keep-going` to not stop on error  
   adjust `--jobs` based on how many parallel requests your inference provider allows
