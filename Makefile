transT:
	MEDAILY_ENV='$(m)' ./node_modules/.bin/tsx scripts/grant-token.ts --email nguyenanhnguyen3006@gmail.com --person "Tường" \
		--account "BIDV" --category "Ăn tiệm" --max 200000 --days 365

decryptT:
	MEDAILY_ENV='$(m)' ./node_modules/.bin/tsx scripts/grant-token.ts --inspect $(t)