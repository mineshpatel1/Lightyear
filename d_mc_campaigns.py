#! /usr/bin/env python
# MailChimp integration

import lyf, logging
from lyf import psql

from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

def main():
	try:
		campaigns = lyf.get_mc_campaigns()

		db = psql.DB()
		i = 0
		for campaign in campaigns:
			db.upsert('d_mc_campaigns', campaign.__dict__, ['campaign_id']) # Update dimension
			i += 1

		db.close()
		logging.info('Merged %s rows into d_mc_campaigns.' % i)
	except Exception as err:
		logging.error(err)

if __name__ == '__main__':
	main()
